"""Tests for the recent-days diet statistics aggregation."""

from __future__ import annotations

from datetime import timedelta

import pytest

from api.lib.validators import app_today
from api.stats import (
    DEFAULT_DAYS,
    MAX_DAYS,
    build_stats,
    clean_ratio,
    empty_stats,
    requested_days,
    window_bounds,
)


def meal(date: str, type: str) -> dict:
    return {"date": date, "type": type}


def test_window_defaults_to_the_last_seven_days_including_today() -> None:
    start, end = window_bounds(DEFAULT_DAYS)

    assert end == app_today().isoformat()
    assert start == (app_today() - timedelta(days=6)).isoformat()


def test_requested_days_reads_the_optional_window_size() -> None:
    assert requested_days("/api/stats") == DEFAULT_DAYS
    assert requested_days("/api/stats?days=30") == 30
    assert requested_days(f"/api/stats?days={MAX_DAYS}") == MAX_DAYS


@pytest.mark.parametrize(
    "query", ["days=0", "days=-1", f"days={MAX_DAYS + 1}", "days=week", "days=7&days=8"]
)
def test_requested_days_rejects_values_outside_the_allowed_window(query: str) -> None:
    with pytest.raises(ValueError):
        requested_days(f"/api/stats?{query}")


def test_counts_clean_and_free_meals_across_the_window() -> None:
    rows = [
        meal("2026-08-14", "clean"),
        meal("2026-08-14", "clean"),
        meal("2026-08-15", "free"),
        meal("2026-08-16", "clean"),
    ]

    stats = build_stats(7, "2026-08-14", "2026-08-20", rows)

    assert stats["total"] == 4
    assert stats["clean"] == 3
    assert stats["free"] == 1
    assert stats["range"] == {"start": "2026-08-14", "end": "2026-08-20", "days": 7}


def test_reports_the_example_ratio_from_the_requirements() -> None:
    rows = [meal("2026-08-14", "clean") for _ in range(16)]
    rows += [meal("2026-08-15", "free") for _ in range(5)]

    stats = build_stats(7, "2026-08-14", "2026-08-20", rows)

    assert stats["total"] == 21
    assert stats["clean"] == 16
    assert stats["free"] == 5
    assert stats["cleanRatio"] == 76


def test_counts_days_that_hold_at_least_one_record() -> None:
    rows = [
        meal("2026-08-14", "clean"),
        meal("2026-08-14", "free"),
        meal("2026-08-16", "clean"),
    ]

    assert build_stats(7, "2026-08-14", "2026-08-20", rows)["recordedDays"] == 2


def test_an_empty_window_reports_zeroes_instead_of_failing() -> None:
    stats = build_stats(7, "2026-08-14", "2026-08-20", [])

    assert stats["total"] == 0
    assert stats["clean"] == 0
    assert stats["free"] == 0
    assert stats["cleanRatio"] == 0
    assert stats["recordedDays"] == 0


def test_a_row_with_an_unknown_type_is_skipped_rather_than_raising() -> None:
    rows = [
        meal("2026-08-14", "clean"),
        meal("2026-08-14", "brunch"),
        {"date": "2026-08-15"},
    ]

    stats = build_stats(7, "2026-08-14", "2026-08-20", rows)

    assert stats["total"] == 1
    assert stats["clean"] == 1
    assert stats["recordedDays"] == 1


def test_empty_stats_matches_a_window_with_no_records() -> None:
    assert empty_stats(7, "2026-08-14", "2026-08-20") == build_stats(
        7, "2026-08-14", "2026-08-20", []
    )


@pytest.mark.parametrize(
    ("clean", "total", "expected"),
    [(0, 0, 0), (16, 21, 76), (1, 3, 33), (2, 3, 67), (7, 7, 100), (0, 4, 0)],
)
def test_clean_ratio_rounds_to_a_whole_percent(clean: int, total: int, expected: int) -> None:
    assert clean_ratio(clean, total) == expected
