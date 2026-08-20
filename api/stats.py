"""Aggregate the signed-in member's recent meals into simple diet statistics.

The window is small by design — seven days hold at most 28 meal rows — so the
rows are fetched once and counted in Python instead of pushing a GROUP BY into
PostgREST. That keeps the rule visible in one readable function and makes it
directly testable without a database.
"""

from __future__ import annotations

from datetime import timedelta
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from pydantic import ValidationError

from api.lib.auth import AuthenticationRequiredError, require_member
from api.lib.http import status_for_error_code
from api.lib.logging import log_internal_error
from api.lib.response import (
    auth_required_response,
    internal_error_response,
    json_bytes,
    success_response,
    validation_error_response,
)
from api.lib.supabase_client import SupabaseConfigurationError, get_supabase_client
from api.lib.validators import app_today
from api.models.stats import StatsResponse

DEFAULT_DAYS = 7
MAX_DAYS = 90


def _send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json_bytes(payload)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def requested_days(path: str) -> int:
    """Read the optional window size, defaulting to the last seven days."""

    values = parse_qs(urlparse(path).query).get("days", [])
    if not values:
        return DEFAULT_DAYS
    if len(values) != 1:
        raise ValueError("days query parameter must be given once")
    try:
        days = int(values[0])
    except ValueError as error:
        raise ValueError("days query parameter must be a whole number") from error
    if not 1 <= days <= MAX_DAYS:
        raise ValueError(f"days query parameter must be between 1 and {MAX_DAYS}")
    return days


def window_bounds(days: int) -> tuple[str, str]:
    """Return the inclusive ISO start and end of a window ending today."""

    end = app_today()
    start = end - timedelta(days=days - 1)
    return start.isoformat(), end.isoformat()


def clean_ratio(clean: int, total: int) -> int:
    """Return the clean share as a whole percent, and 0 when nothing is recorded."""

    if total <= 0:
        return 0
    return round(clean * 100 / total)


def build_stats(days: int, start: str, end: str, meal_rows: list[dict]) -> dict:
    """Count the meals in one window.

    Rows carrying an unexpected ``type`` are left out of the clean and free
    counts rather than raising, so one malformed record cannot take the whole
    statistics screen down.
    """

    clean = 0
    free = 0
    recorded_dates: set[str] = set()
    for row in meal_rows:
        meal_type = row.get("type")
        if meal_type == "clean":
            clean += 1
        elif meal_type == "free":
            free += 1
        else:
            continue
        recorded_dates.add(str(row.get("date")))

    total = clean + free
    payload = {
        "range": {"start": start, "end": end, "days": days},
        "total": total,
        "clean": clean,
        "free": free,
        "cleanRatio": clean_ratio(clean, total),
        "recordedDays": len(recorded_dates),
    }
    return StatsResponse.model_validate(payload).model_dump(mode="json")


def empty_stats(days: int, start: str, end: str) -> dict:
    """Return a zeroed response so a failed aggregation still renders a screen."""

    return build_stats(days, start, end, [])


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            days = requested_days(self.path)
        except ValueError:
            _send_json(
                self,
                status_for_error_code("VALIDATION_ERROR"),
                validation_error_response(),
            )
            return

        try:
            member = require_member(self)
            start, end = window_bounds(days)
            meals = (
                get_supabase_client()
                .table("meals")
                .select("date,type")
                .eq("member_id", member.id)
                .gte("date", start)
                .lte("date", end)
                .execute()
            )
            _send_json(self, 200, success_response(build_stats(days, start, end, meals.data or [])))
        except AuthenticationRequiredError:
            _send_json(self, 401, auth_required_response())
        except (SupabaseConfigurationError, ValidationError) as error:
            log_internal_error("stats.get", error)
            _send_json(self, 500, internal_error_response())
        except Exception as error:
            log_internal_error("stats.get", error)
            _send_json(self, 500, internal_error_response())
