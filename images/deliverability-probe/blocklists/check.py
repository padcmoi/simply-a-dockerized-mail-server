"""A list that did not answer has cleared nothing. Spamhaus and others refuse
queries from public resolvers and say so with 127.255.255.x, and dnswl uses
127.0.0.255 for the same: turning either into a green tick would make the whole
page a lie. So green is reserved for the case where every list actually replied,
and short of that the row says how many did and names the silent ones."""

ORDER = 600
ID = "blocklists"
SECTION = "reputation"


import context_dnsbl as dnsbl

LISTS = [
    "zen.spamhaus.org",
    "bl.spamcop.net",
    "b.barracudacentral.org",
    "dnsbl.sorbs.net",
    "psbl.surriel.com",
    "ix.dnsbl.manitu.net",
]


def run(ctx):
    ip = ctx.mail_ip()
    if not ip:
        return None

    answers = [(zone, dnsbl.query(ctx, ip, zone)) for zone in LISTS]
    listed = [(zone, r) for zone, r in answers if r["verdict"] == "listed"]
    silent = [zone for zone, r in answers if r["verdict"] == "unavailable"]
    replied = len(answers) - len(silent)

    if listed:
        return {
            "status": "fail",
            "evidence": ", ".join(f"{zone} ({','.join(r['codes'])})" for zone, r in listed),
            "params": {"count": len(listed)},
        }
    if silent:
        return {
            "status": "warn",
            "evidence": f"{replied}/{len(answers)}, no answer from {', '.join(silent)}",
            "params": {"checked": replied, "total": len(answers), "silent": len(silent)},
        }
    return {
        "status": "pass",
        "evidence": f"{replied}/{len(answers)}",
        "params": {"checked": replied, "total": len(answers), "silent": 0},
    }
