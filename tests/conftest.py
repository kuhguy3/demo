import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

PAGES = {
    "/": b'<html><body><a href="/about">About</a><a href="/secret">shh</a></body></html>',
    "/about": b"<html><body>About page</body></html>",
    "/secret": b"top secret",
    "/login": (
        b'<html><body><form action="/do-login" method="post">'
        b'<input name="username"><input name="password" type="password">'
        b"</form></body></html>"
    ),
    "/robots.txt": b"User-agent: *\nDisallow: /admin\nDisallow: /backup\n",
    "/sitemap.xml": (
        b'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        b"<url><loc>http://example.com/page1</loc></url>"
        b"</urlset>"
    ),
}


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = PAGES.get(self.path)
        if body is None:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"not found")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Set-Cookie", "session=abc123")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


@pytest.fixture
def local_server():
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        yield base_url
    finally:
        server.shutdown()
        server.server_close()
