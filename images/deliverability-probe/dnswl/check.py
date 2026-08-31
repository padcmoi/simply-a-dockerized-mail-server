"""dnswl answers 127.0.<category>.<trust>, trust running from 0 to 3, and hands
127.0.0.255 to a resolver it has stopped serving. That code sits in the same
127.0.0.x shape as a listing, which is exactly why it was read as one and painted
a green tick over a refusal."""

ORDER = 610
ID = "dnswl"
SECTION = "reputation"


import context_dnsbl as dnsbl

ZONE = "list.dnswl.org"


def run(ctx):
    ip = ctx.mail_ip()
    if not ip:
        return None

    answer = dnsbl.query(ctx, ip, ZONE)
    if answer["verdict"] == "unavailable":
        return {"status": "warn", "evidence": "no answer"}
    if answer["verdict"] == "clean":
        return {"status": "warn", "evidence": "not listed"}

    trust = max((int(code.split(".")[3]) for code in answer["codes"] if code.count(".") == 3), default=0)
    if trust == 0:
        return {"status": "warn", "evidence": "listed with trust none"}
    return {
        "status": "pass",
        "evidence": f"trust {trust} ({','.join(answer['codes'])})",
        "params": {"trust": trust},
    }
