"""A one-way PTR counts for nothing: the name it gives must lead back to the address it was read from."""

ORDER = 40
ID = "ptr-fcrdns"
SECTION = "identity"


def run(ctx):
    ip, name = ctx.mail_ip(), ctx.ptr_name()
    if not ip or not name:
        return None
    back = ctx.a(name) or []
    ok = ip in back
    return {
        "status": "pass" if ok else "fail",
        "evidence": f"{name} -> {', '.join(back) or '-'}",
        "params": {"ip": ip},
    }

