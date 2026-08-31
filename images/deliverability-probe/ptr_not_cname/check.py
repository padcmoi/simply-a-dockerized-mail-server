"""A PTR pointing at a CNAME resolves, but some scorers penalise the extra hop."""

ORDER = 50
ID = "ptr-not-cname"
SECTION = "identity"


def run(ctx):
    name = ctx.ptr_name()
    if not name:
        return None
    alias = ctx.cname(name)
    if alias:
        return {"status": "warn", "evidence": ", ".join(alias)}
    return {"status": "pass", "evidence": name}

