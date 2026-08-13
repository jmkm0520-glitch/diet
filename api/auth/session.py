"""Return the current member, refreshing an expired access token when possible."""

from http.server import BaseHTTPRequestHandler

from api.lib.auth import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    _cookie_value,
    clear_session_cookies,
    member_payload,
    require_member,
    session_from_auth_response,
    set_session_cookies,
)
from api.lib.response import auth_required_response, json_bytes, success_response
from api.lib.supabase_client import create_supabase_auth_client


def _send(handler, status: int, payload: dict, session=None, clear=False) -> None:
    body = json_bytes(payload)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    if session:
        set_session_cookies(handler, session)
    if clear:
        clear_session_cookies(handler)
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            _send(self, 200, success_response(member_payload(require_member(self))))
            return
        except Exception:
            refresh_token = _cookie_value(self, REFRESH_COOKIE)
        if refresh_token:
            try:
                session = session_from_auth_response(
                    create_supabase_auth_client().auth.refresh_session(refresh_token)
                )
                # Make the refreshed token visible to the member lookup without mutating the request.
                self.headers["Cookie"] = f"{ACCESS_COOKIE}={session.access_token}"
                _send(self, 200, success_response(member_payload(require_member(self))), session)
                return
            except Exception:
                pass
        _send(self, 401, auth_required_response(), clear=True)
