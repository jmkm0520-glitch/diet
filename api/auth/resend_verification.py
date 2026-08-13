"""Resend the pending member's signup verification email."""

import json
from http.server import BaseHTTPRequestHandler

from pydantic import ValidationError

from api.lib.logging import log_internal_error
from api.lib.request import RequestBodyTooLargeError, UnsupportedMediaTypeError, read_json_body
from api.lib.response import error_response, internal_error_response, json_bytes, success_response
from api.lib.supabase_client import create_supabase_auth_client, get_supabase_client
from api.models.auth import ResendVerificationRequest


def _send(handler, status: int, payload: dict) -> None:
    body = json_bytes(payload)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            request = ResendVerificationRequest.model_validate(json.loads(read_json_body(self)))
        except (
            RequestBodyTooLargeError,
            UnsupportedMediaTypeError,
            json.JSONDecodeError,
            ValidationError,
        ):
            # Do not expose whether an email is the reserved address.
            _send(self, 202, success_response({"sent": True}))
            return

        try:
            claim = (
                get_supabase_client()
                .table("member_signup_claims")
                .select("email")
                .eq("email", str(request.email).lower())
                .limit(1)
                .execute()
            )
            if claim.data:
                create_supabase_auth_client().auth.resend(
                    {"type": "signup", "email": str(request.email)}
                )
            _send(self, 202, success_response({"sent": True}))
        except Exception as error:
            if "rate" in str(error).lower():
                _send(
                    self,
                    429,
                    error_response("RATE_LIMITED", "잠시 후 인증 메일을 다시 요청해 주세요."),
                )
                return
            log_internal_error("auth.resend_verification", error)
            _send(self, 500, internal_error_response())
