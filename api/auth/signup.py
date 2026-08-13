"""Create the first and only application member."""

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
from api.models.auth import SignupRequest


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


def member_exists(client) -> bool:
    return bool(client.table("members").select("id", count="exact").limit(1).execute().data)


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            _send(
                self, 200, success_response({"canCreate": not member_exists(get_supabase_client())})
            )
        except Exception as error:
            log_internal_error("auth.signup.status", error)
            _send(self, 500, internal_error_response())

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
        created_user = None
        try:
            if member_exists(client):
                _send(
                    self,
                    409,
                    error_response("MEMBER_EXISTS", "이 서비스의 회원은 이미 생성되었습니다."),
                )
                return
            created = client.auth.admin.create_user(
                {"email": str(request.email), "password": request.password, "email_confirm": True}
            )
            created_user = created.user
            result = client.rpc(
                "claim_single_member",
                {
                    "requested_user_id": str(created_user.id),
                    "requested_email": str(request.email),
                    "requested_display_name": request.display_name,
                },
            ).execute()
            row = result.data
            if isinstance(row, list):
                row = (row or [None])[0]
            login = create_supabase_auth_client().auth.sign_in_with_password(
                {"email": str(request.email), "password": request.password}
            )
            session = session_from_auth_response(login)
            _send(self, 201, success_response(member_payload(member_from_row(row))), session)
        except Exception as error:
            if created_user:
                try:
                    client.auth.admin.delete_user(str(created_user.id))
                except Exception as cleanup_error:
                    log_internal_error("auth.signup.cleanup", cleanup_error)
            if "SINGLE_MEMBER_EXISTS" in str(error):
                _send(
                    self,
                    409,
                    error_response("MEMBER_EXISTS", "이 서비스의 회원은 이미 생성되었습니다."),
                )
                return
            log_internal_error("auth.signup", error)
            _send(self, 500, internal_error_response())
