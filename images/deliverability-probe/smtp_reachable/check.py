"""Port 25 answering at all, read from a real session rather than from a port scan."""

ORDER = 100
ID = "smtp-reachable"
SECTION = "server"


def run(ctx):
    if not ctx.mail_ip():
        return None
    session = ctx.session()
    if not session.reachable:
        return {"status": "fail", "evidence": session.error or ""}
    return {"status": "pass", "evidence": session.banner}
