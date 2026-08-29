"""DANE only means something under DNSSEC, and a zone without it is not at
fault. So the row appears when there is something to say and stays away when the
answer would be "not applicable to you"."""

ORDER = 520
ID = "dane"
SECTION = "dns"


def run(ctx):
    host = ctx.mx_host()
    if not host:
        return None
    answer = ctx.query(f"_25._tcp.{host}", "TLSA")
    if not answer:
        return None
    return {"status": "pass", "evidence": " ".join(str(row) for row in answer)[:80]}
