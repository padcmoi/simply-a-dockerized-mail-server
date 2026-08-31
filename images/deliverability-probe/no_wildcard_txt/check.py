"""A wildcard TXT answers for every name and confuses SPF, DKIM and DMARC lookups alike."""

ORDER = 530
ID = "no-wildcard-txt"
SECTION = "dns"


import time


def run(ctx):
    name = f"deliverability-probe-{int(time.time())}.{ctx.domain}"
    found = ctx.txt(name)
    return {
        "status": "warn" if found else "pass",
        "evidence": " ".join(found)[:80] if found else "",
    }
