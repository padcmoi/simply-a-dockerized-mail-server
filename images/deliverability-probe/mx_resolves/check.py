"""An MX name pointing at nothing is worse than no MX: mail is attempted, then bounces."""

ORDER = 20
ID = "mx-resolves"
SECTION = "identity"


def run(ctx):
    host = ctx.mx_host()
    if not host:
        return None
    found = ctx.a(host)
    if not found:
        return {"status": "fail", "evidence": host}
    return {"status": "pass", "evidence": f"{host} -> {', '.join(found)}"}

