"""Verify the signup email code and complete member creation."""

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
from api.models.auth import EmailVerificationRequest


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
            request = EmailVerificationRequest.model_validate(json.loads(read_json_body(self)))
        except (
            RequestBodyTooLargeError,
            UnsupportedMediaTypeError,
            json.JSONDecodeError,
            ValidationError,
        ):
            _send(self, 400, validation_error_response())
            return

        try:
            verified = create_supabase_auth_client().auth.verify_otp(
                {"email": str(request.email), "token": request.token, "type": "email"}
            )
            session = session_from_auth_response(verified)
            if not verified.user:
                raise RuntimeError("Email verification returned no user")
            result = (
                get_supabase_client()
                .rpc(
                    "complete_verified_member_signup",
                    {
                        "requested_user_id": str(verified.user.id),
                        "requested_email": str(request.email),
                    },
                )
                .execute()
            )
            row = result.data
            if isinstance(row, list):
                row = (row or [None])[0]
            _send(self, 201, success_response(member_payload(member_from_row(row))), session)
        except Exception as error:
            message = str(error)
            if "expired" in message.lower() or "invalid" in message.lower():
                _send(
                    self,
                    400,
                    error_response(
                        "INVALID_VERIFICATION_CODE",
                        "인증번호가 올바르지 않거나 만료되었습니다.",
                    ),
                )
                return
            if "SIGNUP_CLAIM_NOT_FOUND" in message or "EMAIL_NOT_VERIFIED" in message:
                _send(
                    self,
                    400,
                    error_response(
                        "VERIFICATION_FAILED", "가입 대기 정보와 이메일 인증 상태를 확인해 주세요."
                    ),
                )
                return
            log_internal_error("auth.verify_email", error)
            _send(self, 500, internal_error_response())
