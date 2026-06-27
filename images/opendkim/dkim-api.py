#!/usr/bin/env python3
"""
Internal DKIM API sidecar.

Lives in the opendkim container, listens on the mail bridge network only
(no host port published). manager-api calls these endpoints whenever an
admin adds a domain or rotates its DKIM key.

Endpoints
---------
GET    /healthz                       -> 200 ok
GET    /keys/<domain>                 -> list selectors and TXT records
POST   /keys/<domain>                 -> generate a new keypair, append to
                                         key.table + signing.table, reload
                                         opendkim, return TXT record
DELETE /keys/<domain>?selector=<sel>  -> remove the given selector, reload

The server is intentionally tiny (stdlib http.server, no auth) because the
threat model is the same as redis or rspamd: trust everything on the docker
bridge, expose nothing on the host.
"""

import datetime as _dt
import grp
import json
import os
import pwd
import re
import signal
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

CONF_DIR = "/etc/opendkim"
KEYS_DIR = os.path.join(CONF_DIR, "keys")
KEY_TABLE = os.path.join(CONF_DIR, "key.table")
SIGNING_TABLE = os.path.join(CONF_DIR, "signing.table")
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8080

DOMAIN_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")
SELECTOR_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _opendkim_uid_gid() -> tuple[int, int]:
    return pwd.getpwnam("opendkim").pw_uid, grp.getgrnam("opendkim").gr_gid


def _default_selector() -> str:
    # No underscore: some DNS providers / legacy validators do not handle
    # underscores inside the selector well. dkim<YYYYMM> stays sortable and
    # rotates monthly.
    return "dkim" + _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m")


def _read_txt(domain: str, selector: str) -> str:
    """Read the BIND-format .txt produced by opendkim-genkey and return the
    single-line DKIM record value (v=DKIM1; k=rsa; p=...)."""
    path = os.path.join(KEYS_DIR, domain, f"{selector}.txt")
    parts = []
    with open(path) as f:
        for line in f:
            for m in re.findall(r'"([^"]*)"', line):
                parts.append(m)
    return "".join(parts)


def _reload_opendkim() -> None:
    # Send SIGHUP to every running opendkim process in this container so it
    # reloads key.table / signing.table. The sidecar runs in the same PID
    # namespace as opendkim itself (tini supervises both). Read /proc directly
    # to avoid depending on procps-ng (busybox alpine ships only a stub).
    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue
        try:
            with open(f"/proc/{entry}/comm") as f:
                name = f.read().strip()
        except OSError:
            continue
        if name == "opendkim":
            try:
                os.kill(int(entry), signal.SIGHUP)
            except (OSError, ProcessLookupError):
                pass


def _table_append(path: str, line: str) -> None:
    # Idempotent append: skip if the exact line already exists.
    if os.path.exists(path):
        with open(path) as f:
            for existing in f:
                if existing.rstrip("\n") == line:
                    return
    with open(path, "a") as f:
        f.write(line + "\n")


def _table_remove(path: str, predicate) -> int:
    if not os.path.exists(path):
        return 0
    removed = 0
    kept: list[str] = []
    with open(path) as f:
        for raw in f:
            line = raw.rstrip("\n")
            if predicate(line):
                removed += 1
            else:
                kept.append(raw)
    if removed:
        with open(path, "w") as f:
            f.writelines(kept)
    return removed


def generate_key(domain: str, selector: str) -> dict:
    if not DOMAIN_RE.match(domain):
        raise ValueError(f"invalid domain: {domain!r}")
    if not SELECTOR_RE.match(selector):
        raise ValueError(f"invalid selector: {selector!r}")

    dom_dir = os.path.join(KEYS_DIR, domain)
    os.makedirs(dom_dir, exist_ok=True)
    private_path = os.path.join(dom_dir, f"{selector}.private")

    if not os.path.exists(private_path):
        subprocess.run(
            ["opendkim-genkey", "-b", "2048", "-d", domain, "-s", selector, "-D", dom_dir],
            check=True,
        )
        uid, gid = _opendkim_uid_gid()
        for name in (f"{selector}.private", f"{selector}.txt"):
            os.chown(os.path.join(dom_dir, name), uid, gid)
            os.chmod(os.path.join(dom_dir, name), 0o600)

    _table_append(KEY_TABLE, f"{selector}._domainkey.{domain} {domain}:{selector}:{private_path}")
    _table_append(SIGNING_TABLE, f"*@{domain} {selector}._domainkey.{domain}")
    _reload_opendkim()

    return {
        "domain": domain,
        "selector": selector,
        "dnsName": f"{selector}._domainkey",
        "txtRecord": _read_txt(domain, selector),
    }


def list_keys(domain: str) -> list[dict]:
    if not DOMAIN_RE.match(domain):
        raise ValueError(f"invalid domain: {domain!r}")
    dom_dir = os.path.join(KEYS_DIR, domain)
    if not os.path.isdir(dom_dir):
        return []
    out: list[dict] = []
    for name in sorted(os.listdir(dom_dir)):
        if not name.endswith(".txt"):
            continue
        selector = name[:-4]
        out.append(
            {
                "domain": domain,
                "selector": selector,
                "dnsName": f"{selector}._domainkey",
                "txtRecord": _read_txt(domain, selector),
            }
        )
    return out


def delete_key(domain: str, selector: str) -> dict:
    if not DOMAIN_RE.match(domain):
        raise ValueError(f"invalid domain: {domain!r}")
    if not SELECTOR_RE.match(selector):
        raise ValueError(f"invalid selector: {selector!r}")

    dom_dir = os.path.join(KEYS_DIR, domain)
    private = os.path.join(dom_dir, f"{selector}.private")
    txt = os.path.join(dom_dir, f"{selector}.txt")
    removed_files = []
    for path in (private, txt):
        if os.path.exists(path):
            os.remove(path)
            removed_files.append(os.path.basename(path))

    key_marker = f"{selector}._domainkey.{domain} "
    sign_marker = f" {selector}._domainkey.{domain}"
    removed_key = _table_remove(KEY_TABLE, lambda line: line.startswith(key_marker))
    removed_sign = _table_remove(SIGNING_TABLE, lambda line: line.endswith(sign_marker))

    _reload_opendkim()
    return {
        "domain": domain,
        "selector": selector,
        "removedFiles": removed_files,
        "removedKeyTable": removed_key,
        "removedSigningTable": removed_sign,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "dkim-api/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[dkim-api] " + (fmt % args) + "\n")

    def _send(self, code: int, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def _match_domain(self, path: str) -> str | None:
        m = re.fullmatch(r"/keys/([^/?]+)", path)
        return m.group(1) if m else None

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/healthz":
            return self._send(200, {"status": "ok"})
        domain = self._match_domain(url.path)
        if domain:
            try:
                return self._send(200, {"keys": list_keys(domain)})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        url = urlparse(self.path)
        domain = self._match_domain(url.path)
        if not domain:
            return self._send(404, {"error": "not found"})
        body = self._read_body()
        selector = body.get("selector") or _default_selector()
        try:
            result = generate_key(domain, selector)
            return self._send(201, result)
        except ValueError as e:
            return self._send(400, {"error": str(e)})
        except subprocess.CalledProcessError as e:
            return self._send(500, {"error": "opendkim-genkey failed", "detail": str(e)})

    def do_DELETE(self):
        url = urlparse(self.path)
        domain = self._match_domain(url.path)
        if not domain:
            return self._send(404, {"error": "not found"})
        qs = parse_qs(url.query)
        selector = (qs.get("selector") or [None])[0]
        if not selector:
            return self._send(400, {"error": "missing ?selector= query parameter"})
        try:
            return self._send(200, delete_key(domain, selector))
        except ValueError as e:
            return self._send(400, {"error": str(e)})


def main():
    os.makedirs(KEYS_DIR, exist_ok=True)
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    signal.signal(signal.SIGTERM, lambda *_: server.shutdown())
    sys.stderr.write(f"[dkim-api] listening on {LISTEN_HOST}:{LISTEN_PORT}\n")
    server.serve_forever()


if __name__ == "__main__":
    main()
