"""MTA-STS forces TLS towards the domain and reads as a sign of seriousness. The
TXT record is only half of it: without the policy actually served over HTTPS it
announces a promise nothing keeps, so the policy is fetched."""

ORDER = 500
ID = "mta-sts"
SECTION = "dns"


import http.client
import ssl


def _policy(domain):
    try:
        conn = http.client.HTTPSConnection(f"mta-sts.{domain}", timeout=6, context=ssl._create_unverified_context())
        conn.request("GET", "/.well-known/mta-sts.txt")
        res = conn.getresponse()
        if res.status != 200:
            return None
        return res.read(4096).decode("utf-8", "replace").strip() or None
    except Exception:  # noqa: BLE001
        return None
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass


def run(ctx):
    records = ctx.txt(f"_mta-sts.{ctx.domain}") or []
    declared = next((r for r in records if r.lower().startswith("v=stsv1")), None)
    if not declared:
        # One row for one missing thing: the served policy is a question that
        # only exists once a record announces one.
        return {"status": "warn"}

    served = _policy(ctx.domain)
    return [
        {"status": "pass", "evidence": declared},
        {
            "id": "mta-sts-policy",
            "status": "pass" if served else "fail",
            "evidence": (served or "not served")[:80],
        },
    ]
