"""Clear the browser session cookies."""

from http.server import BaseHTTPRequestHandler

from api.lib.auth import clear_session_cookies
from api.lib.response import json_bytes, success_response


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        body = json_bytes(success_response({"loggedOut": True}))
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        clear_session_cookies(self)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
