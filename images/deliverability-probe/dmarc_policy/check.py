"""p=none observes without protecting. Once DKIM passes, quarantine then reject."""

ORDER = 410
ID = "dmarc-policy"
SECTION = "dns"


import re


def run(ctx):
    records = ctx.dmarc()
    if not records:
        return None
    found = re.search(r"(?:^|;)\s*p=(\w+)", records[0], re.I)
    policy = (found.group(1) if found else "none").lower()
    return {
        "status": "warn" if policy == "none" else "pass",
        "evidence": f"p={policy}",
        "params": {"policy": policy},
    }
