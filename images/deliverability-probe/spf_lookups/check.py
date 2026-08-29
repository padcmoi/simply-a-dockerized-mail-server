"""Past ten DNS lookups the evaluation is a permerror, and stacking include: is how it happens."""

ORDER = 230
ID = "spf-lookups"
SECTION = "dns"


import re

COSTLY = re.compile(r"^[+~?-]?(include|a|mx|ptr|exists|redirect)([:=]|$)", re.I)


def run(ctx):
    records = ctx.spf()
    if not records:
        return None
    count = sum(1 for m in records[0].split()[1:] if COSTLY.match(m))
    return {
        "status": "pass" if count <= 10 else "fail",
        "evidence": f"{count}/10",
        "params": {"count": count},
    }
