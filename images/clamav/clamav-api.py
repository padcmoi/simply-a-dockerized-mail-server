#!/usr/bin/env python3
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BIND = os.environ.get("CLAMAV_API_BIND", "172.200.0.12")
PORT = int(os.environ.get("CLAMAV_API_PORT", "8082"))
CONFIG = os.environ.get("CLAMAV_FRESHCLAM_CONF", "/etc/clamav/freshclam.conf")
TIMEOUT = int(os.environ.get("CLAMAV_UPDATE_TIMEOUT", "600"))

LINES = 40

running = threading.Lock()


class UpdateError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def update():
    if not running.acquire(blocking=False):
        raise UpdateError(409, "an update is already running")
    try:
        run = subprocess.run(
            ["freshclam", "--config-file=" + CONFIG, "--stdout", "--no-warnings"],
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
        )
    except FileNotFoundError as e:
        raise UpdateError(503, "freshclam is missing") from e
    except subprocess.TimeoutExpired as e:
        raise UpdateError(504, "the update did not finish in time") from e
    finally:
        running.release()

    output = (run.stdout or run.stderr or "").strip().splitlines()[-LINES:]
    # freshclam answers 0 when it downloaded something and when everything was
    # already current; anything else is a failure worth reading.
    if run.returncode != 0:
        raise UpdateError(502, output[-1] if output else "the update failed")
    return {"output": output, "updated": any("updated" in line for line in output)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        return

    def send(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/healthz":
            return self.send(200, {"ok": True})
        self.send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/update":
            return self.send(404, {"error": "not found"})
        try:
            self.send(200, update())
        except UpdateError as e:
            self.send(e.status, {"error": e.message})


def serve():
    while True:
        try:
            server = ThreadingHTTPServer((BIND, PORT), Handler)
            break
        except OSError:
            time.sleep(2)
    server.serve_forever()


if __name__ == "__main__":
    serve()
