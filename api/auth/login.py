"""Authenticate the single member and issue HttpOnly session cookies."""

import json
from http.server import BaseHTTPRequestHandler

from pydantic import ValidationError

from api.lib.auth import (
    member_from_row,
    member_payload,
    session_from_auth_response,
    set_session_cookies,
)
from api.lib.logging import log_internal_error
from api.lib.request import RequestBodyTooLargeError, UnsupportedMediaTypeError, read_json_body
from api.lib.response import (
    error_response,
    internal_error_response,
    json_bytes,
    success_response,
    validation_error_response,
)
from api.lib.supabase_client import create_supabase_auth_client, get_supabase_client
from api.models.auth import CredentialsRequest


def _send(handler, status: int, payload: dict, session=None) -> None:
    body = json_bytes(payload)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    if session:
        set_session_cookies(handler, session)
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            request = CredentialsRequest.model_validate(json.loads(read_json_body(self)))
        except (
            RequestBodyTooLargeError,
            UnsupportedMediaTypeError,
            json.JSONDecodeError,
            ValidationError,
        ):
            _send(self, 400, validation_error_response())
            return

        try:
            response = create_supabase_auth_client().auth.sign_in_with_password(
                request.model_dump(mode="json")
            )
            session = session_from_auth_response(response)
            member_result = (
                get_supabase_client()
                .table("members")
                .select("id,email,display_name")
                .eq("id", str(response.user.id))
                .limit(1)
                .execute()
            )
            row = (member_result.data or [None])[0]
            if not row:
                _send(
                    self,
                    401,
                    error_response("INVALID_CREDENTIALS", "이메일 또는 비밀번호를 확인해 주세요."),
                )
                return
            _send(self, 200, success_response(member_payload(member_from_row(row))), session)
        except Exception as error:
            # Supabase intentionally does not reveal whether the email exists.
            if "invalid" in str(error).lower() or "credential" in str(error).lower():
                _send(
                    self,
                    401,
                    error_response("INVALID_CREDENTIALS", "이메일 또는 비밀번호를 확인해 주세요."),
                )
                return
            log_internal_error("auth.login", error)
            _send(self, 500, internal_error_response())
