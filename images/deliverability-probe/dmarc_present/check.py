"""Without DMARC receivers have no instruction when authentication fails, and the domain gets no reports."""

ORDER = 400
ID = "dmarc-present"
SECTION = "dns"


def run(ctx):
    records = ctx.dmarc()
    if not records:
        return {"status": "fail"}
    return {"status": "pass", "evidence": records[0]}
