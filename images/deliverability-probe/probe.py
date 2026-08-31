#!/usr/bin/env python3
"""The deliverability engine, run from outside the docker networks.

Every check on the manager's Deliverability page is executed here, and that
placement is the whole point rather than a detail of packaging. Postfix trusts
`mynetworks`, which is the docker network the manager lives on, so a relay
transaction announced from there is accepted by design and says nothing about
the internet. Putting the probe on another bridge does not help either: reaching
the server through its published port makes docker rewrite the source to the
`mail` gateway, which is inside `mynetworks` again.

So this container runs on the host's own network stack. Its packets carry the
machine's public address, exactly like the internet's, and every answer it gets
is the answer a stranger gets.

One check lives in one directory, named after what it tests. Adding a check is
adding a directory; nothing else has to be edited.
"""

import datetime
import importlib.util
import json
import os
import pathlib
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from context import Context

HERE = pathlib.Path(__file__).parent


def log(caller, message):
    """Every request and every verdict, with who asked. A probe that reaches out
    to a mail server and to public blocklists in this installation's name owes an
    account of what it did and on whose behalf."""
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"{stamp} {caller:>15}  {message}", flush=True)


BIND = os.environ.get("PROBE_BIND", "172.200.0.1")
PORT = int(os.environ.get("PROBE_PORT", "8080"))


def load_checks():
    """Every directory holding a check.py is a check, sorted by its ORDER so the
    report reads in the order that matters: identity, then DNS, then the server,
    then reputation."""
    found = []
    for path in sorted(HERE.iterdir()):
        module_file = path / "check.py"
        if not path.is_dir() or not module_file.exists():
            continue
        spec = importlib.util.spec_from_file_location(f"check_{path.name}", module_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        found.append(module)
    return sorted(found, key=lambda m: getattr(m, "ORDER", 999))


CHECKS = load_checks()


def report(domain, selector, caller="-"):
    ctx = Context(domain, selector)
    results = []
    for check in CHECKS:
        started = time.monotonic()
        try:
            produced = check.run(ctx)
        except Exception:  # noqa: BLE001 - a broken check must not sink the report
            produced = {
                "status": "warn",
                "evidence": traceback.format_exc(limit=1).strip().split("\n")[-1],
            }
        spent = int((time.monotonic() - started) * 1000)

        # A check that has nothing to say returns None, and no row is emitted:
        # a line that cannot conclude is a line the reader has to interpret. The
        # log still records that it ran, so silence is never a mystery.
        for row in produced if isinstance(produced, list) else [produced]:
            if not row:
                log(caller, f"     -  {check.ID:24} {spent:>5}ms  not applicable, no row emitted")
                continue
            row_id = row.get("id", check.ID)
            log(caller, f"  {row['status']:>4}  {row_id:24} {spent:>5}ms  {str(row.get('evidence', ''))[:90]}")
            results.append(
                {
                    "id": row_id,
                    "section": row.get("section", check.SECTION),
                    "status": row["status"],
                    "evidence": row.get("evidence", ""),
                    "params": row.get("params") or {},
                }
            )

    counts = {"pass": 0, "warn": 0, "fail": 0}
    for row in results:
        counts[row["status"]] += 1

    source = source_address(ctx.mail_ip())
    log(
        caller,
        f"done  {domain}  mx={ctx.mx_host()} ip={ctx.mail_ip()} from={source} "
        f"pass={counts['pass']} warn={counts['warn']} fail={counts['fail']}",
    )

    return {
        "domain": ctx.domain,
        "mxHost": ctx.mx_host(),
        "mailIp": ctx.mail_ip(),
        "source": source,
        "counts": counts,
        "checks": results,
    }


def source_address(target):
    """The address this probe speaks from, which is what makes its answers
    worth anything: it has to be one postfix does not trust."""
    if not target:
        return ""
    import socket

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect((target, 25))
        return sock.getsockname()[0]
    except OSError:
        return ""
    finally:
        sock.close()


class Handler(BaseHTTPRequestHandler):
    @property
    def caller(self):
        return self.client_address[0]

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)

        if url.path == "/health":
            return self.answer({"ok": True, "checks": [c.ID for c in CHECKS]})
        if url.path != "/report":
            log(self.caller, f"refused {self.path}: unknown path")
            return self.answer({"error": "unknown path"}, 404)

        domain = (query.get("domain") or [""])[0]
        if not domain:
            log(self.caller, "refused /report: no domain given")
            return self.answer({"error": "domain is required"}, 400)

        selector = (query.get("selector") or [""])[0]
        log(self.caller, f"report {domain} (dkim selector {selector or 'none given'})")
        started = time.monotonic()
        answer = report(domain, selector, self.caller)
        log(self.caller, f"answered {domain} in {int((time.monotonic() - started) * 1000)}ms")
        return self.answer(answer)

    def answer(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # The HTTP line itself, kept because it is the only trace of a request
        # that never reached a check: a bad path, a malformed query. The
        # healthcheck is dropped: docker calls it every thirty seconds, and a
        # log where the real requests are one line in sixty is a log nobody
        # reads.
        line = fmt % args
        if "/health" in line:
            return
        log(self.caller, line)


if __name__ == "__main__":
    log("-", f"listening on {BIND}:{PORT} with {len(CHECKS)} checks")
    sys.stdout.flush()
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()
