#!/usr/bin/env python3
import ipaddress
import json
import os
import re
import sqlite3
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BIND = os.environ.get("FAIL2BAN_API_BIND", "172.200.0.1")
PORT = int(os.environ.get("FAIL2BAN_API_PORT", "8081"))
TIMEOUT = 10
CALLS = ThreadPoolExecutor(max_workers=16)
JAILS = ThreadPoolExecutor(max_workers=8)
DATABASE = os.environ.get("FAIL2BAN_DATABASE", "/var/lib/fail2ban/fail2ban.sqlite3")
HISTORY_LIMIT = 200
MANAGER_JAIL = os.environ.get("FAIL2BAN_MANAGER_JAIL", "manager")

JAIL_RE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
BAN_RE = re.compile(r"^(\S+)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \+ (-?\d+) = (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$")
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


def field(text, label):
    match = re.search(rf"{re.escape(label)}:\s*(.*)$", text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def jails():
    listed = field(client("status"), "Jail list")
    return [name.strip() for name in listed.split(",") if name.strip()]


def epoch_ms(stamp):
    return int(time.mktime(time.strptime(stamp, "%Y-%m-%d %H:%M:%S")) * 1000)


def bans(jail):
    found = []
    for line in client("get", jail, "banip", "--with-time").splitlines():
        match = BAN_RE.match(line.strip())
        if match:
            ip, start, duration, end = match.groups()
            found.append({"ip": ip, "bannedAt": epoch_ms(start), "expiresAt": None if int(duration) < 0 else epoch_ms(end)})
    return found


def number(value):
    try:
        return int(value)
    except ValueError:
        return 0


def jail_status(jail):
    status, bantime, findtime, maxretry, banned = [
        future.result()
        for future in [
            CALLS.submit(client, "status", jail),
            CALLS.submit(client, "get", jail, "bantime"),
            CALLS.submit(client, "get", jail, "findtime"),
            CALLS.submit(client, "get", jail, "maxretry"),
            CALLS.submit(bans, jail),
        ]
    ]
    return {
        "name": jail,
        "currentlyFailed": number(field(status, "Currently failed")),
        "totalFailed": number(field(status, "Total failed")),
        "currentlyBanned": number(field(status, "Currently banned")),
        "totalBanned": number(field(status, "Total banned")),
        "bantime": number(bantime.strip()),
        "findtime": number(findtime.strip()),
        "maxretry": number(maxretry.strip()),
        "bans": banned,
    }


def all_jails():
    return [future.result() for future in [JAILS.submit(jail_status, jail) for jail in jails()]]


def matches(data):
    try:
        parsed = json.loads(data) if data else {}
    except (TypeError, ValueError):
        return [], 0
    lines = []
    for match in parsed.get("matches") or []:
        lines.append("".join(match) if isinstance(match, list) else str(match))
    return lines, int(parsed.get("failures") or 0)


def history():
    if not os.path.exists(DATABASE):
        return []
    connection = sqlite3.connect(f"file:{DATABASE}?mode=ro", uri=True, timeout=5)
    try:
        rows = connection.execute(
            "SELECT jail, ip, timeofban, bantime, bancount, data FROM bans ORDER BY timeofban DESC LIMIT ?",
            (HISTORY_LIMIT,),
        ).fetchall()
    except sqlite3.Error as e:
        raise Fail2banError(503, "fail2ban database unreadable") from e
    finally:
        connection.close()
    found = []
    for jail, ip, timeofban, bantime, bancount, data in rows:
        lines, failures = matches(data.decode() if isinstance(data, bytes) else data)
        found.append({
            "jail": jail,
            "ip": ip,
            "bannedAt": int(timeofban) * 1000,
            "expiresAt": None if int(bantime) < 0 else (int(timeofban) + int(bantime)) * 1000,
            "banCount": int(bancount),
            "failures": failures,
            "matches": lines,
        })
    return found


def address(body):
    try:
        return str(ipaddress.ip_address(str(body.get("ip", "")).strip()))
    except ValueError as e:
        raise Fail2banError(400, "invalid ip") from e


def banned():
    names = jails()
    counts = [CALLS.submit(client, "status", jail) for jail in names]
    return {jail: number(field(future.result(), "Currently banned")) for jail, future in zip(names, counts)}


def ban(body):
    if MANAGER_JAIL not in jails():
        raise Fail2banError(503, "manager jail missing")
    client("set", MANAGER_JAIL, "banip", address(body))
    return jail_status(MANAGER_JAIL)


def unban(jail, body):
    if not JAIL_RE.match(jail) or jail not in jails():
        raise Fail2banError(404, "unknown jail")
    client("set", jail, "unbanip", address(body))
    return jail_status(jail)


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
            if self.path == "/banned":
                return self.send(200, {"banned": banned()})
            if self.path == "/status":
                return self.send(200, {"jails": all_jails(), "history": history()})
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
