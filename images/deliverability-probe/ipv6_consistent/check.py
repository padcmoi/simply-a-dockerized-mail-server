"""No IPv6 at all is a comfortable state. Half-configured IPv6 is what burns senders, Gmail being markedly stricter over it."""

ORDER = 60
ID = "ipv6-consistent"
SECTION = "identity"


def run(ctx):
    host = ctx.mx_host()
    if not host:
        return None
    v6 = ctx.aaaa(host)
    if not v6:
        return {"status": "pass", "evidence": "no AAAA"}
    reverse = ctx.ptr(v6[0])
    return {
        "status": "pass" if reverse else "fail",
        "evidence": f"{v6[0]} -> {', '.join(reverse) if reverse else 'no PTR'}",
    }

