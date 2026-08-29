"""The open relay test, and the reason this engine runs outside the docker
networks. A transaction is announced with a foreign sender and a foreign
recipient, and the verdict is read off the RCPT reply. It is abandoned before
DATA: nothing is ever sent.

Two things have to be right or the answer is worthless. The probe must speak
from an address postfix does not trust, or `permit_mynetworks` serves it the way
it would serve an open relay. And both addresses must be deliverable somewhere:
a made-up sender is refused by `reject_unknown_sender_domain`, an example.com
one by its null MX, both long before the relay question is reached, and the
refusal then says nothing about relaying at all."""

ORDER = 140
ID = "open-relay"
SECTION = "server"


import os
import socket

import context

SENDER = os.environ.get("RELAY_PROBE_SENDER", "relay-test@gmail.com")
RECIPIENT = os.environ.get("RELAY_PROBE_RECIPIENT", "relay-test@gmail.com")


def transaction(ip):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(context.SMTP_TIMEOUT)
    try:
        sock.connect((ip, 25))
        source = sock.getsockname()[0]
        context.read_reply(sock)
        sock.sendall(b"EHLO deliverability-probe.example.com\r\n")
        context.read_reply(sock)

        sock.sendall(f"MAIL FROM:<{SENDER}>\r\n".encode())
        sender = context.read_reply(sock)
        if not sender.lstrip().startswith("250"):
            return "closed", context.last_line(sender), source

        sock.sendall(f"RCPT TO:<{RECIPIENT}>\r\n".encode())
        recipient = context.read_reply(sock)
        sock.sendall(b"RSET\r\nQUIT\r\n")

        line = context.last_line(recipient)
        code = int(line[:3]) if line[:3].isdigit() else 0
        return ("open" if 200 <= code < 300 else "closed"), line, source
    except Exception as e:  # noqa: BLE001
        return "unknown", f"{type(e).__name__}: {e}", ""
    finally:
        context.close(sock)


def run(ctx):
    ip = ctx.mail_ip()
    if not ip or not ctx.session().reachable:
        return None

    verdict, reply, source = transaction(ip)
    if verdict == "unknown":
        return {"status": "warn", "evidence": reply}
    return {
        "status": "fail" if verdict == "open" else "pass",
        "evidence": f"{reply} (from {source})",
        "params": {"source": source},
    }
