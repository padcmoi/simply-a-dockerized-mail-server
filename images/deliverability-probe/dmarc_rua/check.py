"""Without rua no report arrives, and the domain stays blind to what fails."""

ORDER = 420
ID = "dmarc-rua"
SECTION = "dns"


import re


def run(ctx):
    records = ctx.dmarc()
    if not records:
        return None
    found = re.search(r"(?:^|;)\s*rua=([^;]+)", records[0], re.I)
    rua = found.group(1).strip() if found else ""
    return {"status": "pass" if rua else "warn", "evidence": rua}
