"""Nothing else reports this, and it is often the whole answer when everything
configurable is already green: an address among generic hosting names is rented
in a range that filters score as one block, and no DNS record changes that.

A majority is already a pool. Waiting for near unanimity cleared the exact case
the check exists for."""

ORDER = 620
ID = "ip-neighbourhood"
SECTION = "reputation"


import re

ROLE = re.compile(
    r"^(vps|vm|srv|serv|host|node|static|dynamic|client|customer|pool|unassigned|no-?rdns)[-.]?[0-9a-f]{2,}",
    re.I,
)


def generic(name, ip):
    """A provider default either spells the address out (1.ip-51-68-127.eu,
    51-68-127-3.static.host.tld) or wears a machine blob behind a role prefix
    (vps-f3513ef8.vps.ovh.net). A name a human chose does neither."""
    first, second, third, _ = ip.split(".")
    if re.search(rf"{first}[-.]{second}[-.]{third}", name):
        return True
    return bool(ROLE.match(name)) or bool(re.match(r"^\d+[-.]", name))


def run(ctx):
    ip = ctx.mail_ip()
    if not ip:
        return None

    parts = ip.split(".")
    last = int(parts[3])
    neighbours = [f"{parts[0]}.{parts[1]}.{parts[2]}.{last + o}" for o in (-4, -3, -2, -1, 1, 2, 3, 4)]
    neighbours = [n for n in neighbours if 0 < int(n.split(".")[3]) < 255]

    names = []
    for address in neighbours:
        found = ctx.ptr(address)
        if found:
            names.append(found[0])
    if not names:
        return None

    pooled = [n for n in names if generic(n, ip)]
    return {
        "status": "warn" if len(pooled) * 2 > len(names) else "pass",
        "evidence": f"{len(pooled)}/{len(names)}: {', '.join(names[:3])}",
        "params": {"generic": len(pooled), "total": len(names)},
    }
