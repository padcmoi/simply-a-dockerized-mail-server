"""Reading a DNS blocklist, and the one rule the page's honesty rests on.

A list answers 127.0.0.x for "listed" and NXDOMAIN for "clean". Anything else is
the list declining to answer, which is NOT clean and must never be reported as
such. 127.255.255.x is the Spamhaus family's refusal and 127.0.0.255 is dnswl's.
"""

import re

REFUSALS = [re.compile(r"^127\.255\.255\."), re.compile(r"^127\.0\.0\.255$")]


def query(ctx, ip, zone):
    reversed_ip = ".".join(reversed(ip.split(".")))
    found = ctx.a(f"{reversed_ip}.{zone}")
    if found is None:
        # NXDOMAIN and a timeout are indistinguishable at this level, so the
        # resolver is asked again for the difference.
        return {"verdict": "clean" if ctx.rcode(f"{reversed_ip}.{zone}") == "empty" else "unavailable", "codes": []}
    if any(shape.match(code) for code in found for shape in REFUSALS):
        return {"verdict": "unavailable", "codes": found}
    return {"verdict": "listed", "codes": found}
