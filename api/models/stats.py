"""Pydantic models for the recent-days diet statistics response."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class StatsRange(BaseModel):
    """The calendar window the statistics were calculated over."""

    model_config = ConfigDict(extra="forbid")

    start: date
    end: date
    days: int = Field(ge=1, le=366)


class StatsResponse(BaseModel):
    """Recent-days meal counts and the clean-meal ratio."""

    model_config = ConfigDict(extra="forbid")

    range: StatsRange
    total: int = Field(ge=0)
    clean: int = Field(ge=0)
    free: int = Field(ge=0)
    cleanRatio: int = Field(ge=0, le=100)
    recordedDays: int = Field(ge=0)
