"""Without SPF nothing states which servers may send for this domain."""

ORDER = 200
ID = "spf-present"
SECTION = "dns"


def run(ctx):
    records = ctx.spf()
    if not records:
        return {"status": "fail"}
    return {"status": "pass", "evidence": records[0]}
