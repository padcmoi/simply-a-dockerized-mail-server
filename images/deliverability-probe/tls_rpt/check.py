"""TLS-RPT reports the TLS failures of servers writing to this domain. One TXT record."""

ORDER = 510
ID = "tls-rpt"
SECTION = "dns"


def run(ctx):
    records = ctx.txt(f"_smtp._tls.{ctx.domain}") or []
    declared = next((r for r in records if r.lower().startswith("v=tlsrptv1")), None)
    return {"status": "pass" if declared else "warn", "evidence": declared or ""}
