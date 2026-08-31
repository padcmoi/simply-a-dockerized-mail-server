"""A domain with no MX is a domain nobody knows where to deliver to."""

ORDER = 10
ID = "mx-present"
SECTION = "identity"


def run(ctx):
    answer = ctx.mx()
    if not answer:
        return {"status": "fail"}
    listed = ", ".join(f"{row.preference} {str(row.exchange).rstrip('.')}" for row in answer)
    return {"status": "pass", "evidence": listed}

