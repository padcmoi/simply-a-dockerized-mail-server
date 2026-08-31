"""A record that authorises everything except the address actually sending is the classic silent failure."""

ORDER = 220
ID = "spf-covers-ip"
SECTION = "dns"


def run(ctx):
    records, ip = ctx.spf(), ctx.mail_ip()
    if not records or not ip:
        return None

    mechanisms = records[0].split()[1:]
    literal = any(m.lower() == f"ip4:{ip}" or m.lower().startswith(f"ip4:{ip}/") for m in mechanisms)
    via_mx = any(m.lstrip("+~?-").lower() == "mx" for m in mechanisms)
    return {
        "status": "pass" if literal or via_mx else "fail",
        "evidence": f"ip4:{ip}" if literal else "mx" if via_mx else "not covered",
        "params": {"ip": ip},
    }
