"""t=y tells verifiers to ignore the outcome, which makes a working signature count for nothing."""

ORDER = 330
ID = "dkim-not-testing"
SECTION = "dns"


import re


def run(ctx):
    if not ctx.selector:
        return None
    published = "".join(ctx.txt(f"{ctx.selector}._domainkey.{ctx.domain}", ctx.authoritative()) or [])
    if not published:
        return None
    testing = re.search(r"(?:^|;)\s*t=[^;]*y", published, re.I)
    return {"status": "warn" if testing else "pass", "evidence": "t=y" if testing else ""}
