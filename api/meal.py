"""Save one breakfast, lunch, dinner, or snack record for a calendar date."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from pydantic import ValidationError

from api.lib.http import status_for_error_code
from api.lib.logging import log_internal_error
from api.lib.request import RequestBodyTooLargeError, UnsupportedMediaTypeError, read_json_body
from api.lib.response import (
    internal_error_response,
    json_bytes,
    success_response,
    validation_error_response,
)
from api.lib.supabase_client import SupabaseConfigurationError, get_supabase_client
from api.lib.validators import validate_date
from api.models.meal import MealUpsertRequest


def _send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json_bytes(payload)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def upsert_meal(client, request: MealUpsertRequest):
    """Save the requested meal, replacing its date-and-meal slot when it exists."""

    return (
        client.table("meals")
        .upsert(request.model_dump(mode="json"), on_conflict="date,meal")
        .execute()
    )


def final_meal_record(result) -> dict:
    """Extract the saved meal record for the standard API response."""

    saved = (result.data or [None])[0]
    if not saved:
        raise RuntimeError("Meal upsert returned no saved record")
    return saved


def requested_date(path: str) -> str:
    """Read one valid date from a meal reset request URL."""

    values = parse_qs(urlparse(path).query).get("date", [])
    if len(values) != 1:
        raise ValueError("date query parameter is required")
    return validate_date(values[0])


def delete_meals_for_date(client, date: str):
    """Delete every meal slot saved for one calendar date."""

    return client.table("meals").delete().eq("date", date).execute()


class handler(BaseHTTPRequestHandler):
    def do_PUT(self) -> None:
        try:
            payload = json.loads(read_json_body(self))
            request = MealUpsertRequest.model_validate(payload)
        except (
            RequestBodyTooLargeError,
            UnsupportedMediaTypeError,
            json.JSONDecodeError,
            ValidationError,
            ValueError,
        ):
            _send_json(
                self,
                status_for_error_code("VALIDATION_ERROR"),
                validation_error_response(),
            )
            return

        try:
            result = upsert_meal(get_supabase_client(), request)
            _send_json(self, 200, success_response(final_meal_record(result)))
        except SupabaseConfigurationError as error:
            log_internal_error("meal.put", error)
            _send_json(self, 500, internal_error_response())
        except Exception as error:
            log_internal_error("meal.put", error)
            _send_json(self, 500, internal_error_response())

    def do_DELETE(self) -> None:
        try:
            date = requested_date(self.path)
        except ValueError:
            _send_json(
                self,
                status_for_error_code("VALIDATION_ERROR"),
                validation_error_response(),
            )
            return

        try:
            result = delete_meals_for_date(get_supabase_client(), date)
            _send_json(
                self,
                200,
                success_response({"date": date, "deleted": len(result.data or [])}),
            )
        except SupabaseConfigurationError as error:
            log_internal_error("meal.delete", error)
            _send_json(self, 500, internal_error_response())
        except Exception as error:
            log_internal_error("meal.delete", error)
            _send_json(self, 500, internal_error_response())
