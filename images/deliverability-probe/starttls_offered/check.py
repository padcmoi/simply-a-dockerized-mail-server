"""Without STARTTLS the mail travels in clear and loses a trust signal on every hop."""

ORDER = 120
ID = "starttls"
SECTION = "server"


def run(ctx):
    session = ctx.session()
    if not session.reachable:
        return None
    return {
        "status": "pass" if session.starttls else "fail",
        "evidence": " ".join(session.capabilities),
    }
