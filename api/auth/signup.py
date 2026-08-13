"""Start email-verified signup for an application member."""

import json
from http.server import BaseHTTPRequestHandler

from pydantic import ValidationError

from api.lib.logging import log_internal_error
from api.lib.request import RequestBodyTooLargeError, UnsupportedMediaTypeError, read_json_body
from api.lib.response import (
    internal_error_response,
    json_bytes,
    success_response,
    validation_error_response,
)
from api.lib.supabase_client import create_supabase_auth_client, get_supabase_client
from api.models.auth import SignupRequest


def _send(handler, status: int, payload: dict) -> None:
    body = json_bytes(payload)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        _send(self, 200, success_response({"canCreate": True}))

    def do_POST(self) -> None:
        try:
            request = SignupRequest.model_validate(json.loads(read_json_body(self)))
        except (
            RequestBodyTooLargeError,
            UnsupportedMediaTypeError,
            json.JSONDecodeError,
            ValidationError,
        ):
            _send(self, 400, validation_error_response())
            return

        client = get_supabase_client()
        try:
            created = create_supabase_auth_client().auth.sign_up(
                {
                    "email": str(request.email),
                    "password": request.password,
                }
            )
            if not created.user:
                raise RuntimeError("Signup returned no user")
            client.rpc(
                "reserve_member_signup",
                {
                    "requested_user_id": str(created.user.id),
                    "requested_email": str(request.email),
                    "requested_display_name": request.display_name,
                },
            ).execute()
            _send(
                self,
                202,
                success_response(
                    {
                        "email": str(request.email),
                        "verificationRequired": True,
                    }
                ),
            )
        except Exception as error:
            log_internal_error("auth.signup", error)
            _send(self, 500, internal_error_response())
