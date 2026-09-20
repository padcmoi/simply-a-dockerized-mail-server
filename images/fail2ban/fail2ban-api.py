#!/usr/bin/env python3
import ipaddress
import json
import os
import re
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BIND = os.environ.get("FAIL2BAN_API_BIND", "172.200.0.1")
PORT = int(os.environ.get("FAIL2BAN_API_PORT", "8081"))
TIMEOUT = 10
MANAGER_JAIL = os.environ.get("FAIL2BAN_MANAGER_JAIL", "manager")

JAIL_RE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
UNBAN_RE = re.compile(r"^/jails/([^/]+)/unban$")


class Fail2banError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def client(*args):
    try:
        run = subprocess.run(["fail2ban-client", *args], capture_output=True, text=True, timeout=TIMEOUT)
    except subprocess.TimeoutExpired as e:
        raise Fail2banError(503, "fail2ban did not answer") from e
    if run.returncode != 0:
        lines = (run.stderr or run.stdout).strip().splitlines()
        raise Fail2banError(503, lines[-1] if lines else "fail2ban failed")
    return run.stdout


def jails():
    listed = re.search(r"Jail list:\s*(.*)$", client("status"), re.MULTILINE)
    return [name.strip() for name in (listed.group(1) if listed else "").split(",") if name.strip()]


def address(body):
    try:
        return str(ipaddress.ip_address(str(body.get("ip", "")).strip()))
    except ValueError as e:
        raise Fail2banError(400, "invalid ip") from e


def ban(body):
    if MANAGER_JAIL not in jails():
        raise Fail2banError(503, "manager jail missing")
    client("set", MANAGER_JAIL, "banip", address(body))
    return {"jail": MANAGER_JAIL}


def unban(jail, body):
    if not JAIL_RE.match(jail) or jail not in jails():
        raise Fail2banError(404, "unknown jail")
    client("set", jail, "unbanip", address(body))
    return {"jail": jail}


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
        try:
            if self.path == "/healthz":
                return self.send(200, {"ok": True})
            self.send(404, {"error": "not found"})
        except Fail2banError as e:
            self.send(e.status, {"error": e.message})

    def do_POST(self):
        match = UNBAN_RE.match(self.path)
        if self.path != "/ban" and not match:
            return self.send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}") if length else {}
            if not isinstance(body, dict):
                raise Fail2banError(400, "invalid body")
            self.send(200, ban(body) if self.path == "/ban" else unban(match.group(1), body))
        except json.JSONDecodeError:
            self.send(400, {"error": "invalid body"})
        except Fail2banError as e:
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
