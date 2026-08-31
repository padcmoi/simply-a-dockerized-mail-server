"""~all is a softfail. Once every sending source is known, -all states it plainly."""

ORDER = 240
ID = "spf-qualifier"
SECTION = "dns"


def run(ctx):
    records = ctx.spf()
    if not records:
        return None
    all_mechanism = next((m for m in records[0].split() if m.lower().endswith("all")), "")
    return {
        "status": "pass" if all_mechanism.startswith("-") else "warn" if all_mechanism else "fail",
        "evidence": all_mechanism or "no all mechanism",
    }
