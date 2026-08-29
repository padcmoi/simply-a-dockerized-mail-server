"""Guessing selector names proves nothing, so the question asked is the rcode of
the `_domainkey` node itself, on the authoritative server rather than through a
cache that may hold a stale NXDOMAIN. NOERROR means a selector exists below it."""

ORDER = 300
ID = "dkim-node"
SECTION = "dns"


def run(ctx):
    state = ctx.rcode(f"_domainkey.{ctx.domain}", ctx.authoritative())
    return {
        "status": "pass" if state == "exists" else "fail" if state == "empty" else "warn",
        "evidence": state,
    }
