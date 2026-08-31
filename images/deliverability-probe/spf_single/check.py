"""Two records is not twice as safe: the RFC makes the evaluation a permerror, a hard failure for every receiver."""

ORDER = 210
ID = "spf-single"
SECTION = "dns"


def run(ctx):
    records = ctx.spf()
    if not records:
        return None
    return {
        "status": "pass" if len(records) == 1 else "fail",
        "evidence": f"{len(records)} records",
        "params": {"count": len(records)},
    }
