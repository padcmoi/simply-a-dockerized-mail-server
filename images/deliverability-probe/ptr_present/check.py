"""Without a reverse name most receivers refuse the mail outright, before any content is read."""

ORDER = 30
ID = "ptr-present"
SECTION = "identity"


def run(ctx):
    ip = ctx.mail_ip()
    if not ip:
        return None
    name = ctx.ptr_name()
    if not name:
        return {"status": "fail", "evidence": ip}
    return {"status": "pass", "evidence": f"{ip} -> {name}"}

