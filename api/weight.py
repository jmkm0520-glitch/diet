"""Upsert one weight record for a calendar date."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler

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
from api.models.weight import WeightUpsertRequest


def _send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json_bytes(payload)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def upsert_weight(client, request: WeightUpsertRequest):
    """Insert or update the single weight row identified by its date."""

    return (
        client.table("weights")
        .upsert(request.model_dump(mode="json"), on_conflict="date")
        .execute()
    )


def final_weight_record(result) -> dict:
    """Extract the final saved row for the response envelope."""

    saved = (result.data or [None])[0]
    if not saved:
        raise RuntimeError("Weight upsert returned no saved record")
    return saved


class handler(BaseHTTPRequestHandler):
    def do_PUT(self) -> None:
        try:
            payload = json.loads(read_json_body(self))
            request = WeightUpsertRequest.model_validate(payload)
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
            result = upsert_weight(get_supabase_client(), request)
            saved = final_weight_record(result)
            _send_json(self, 200, success_response(saved))
        except SupabaseConfigurationError as error:
            log_internal_error("weight.put", error)
            _send_json(self, 500, internal_error_response())
        except Exception as error:
            log_internal_error("weight.put", error)
            _send_json(self, 500, internal_error_response())
