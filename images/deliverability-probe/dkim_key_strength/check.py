"""The key is only proven good by loading it: a truncated or re-wrapped record
parses as base64 and still fails every verifier."""

ORDER = 320
ID = "dkim-key-strength"
SECTION = "dns"


import base64
import re

from cryptography.hazmat.primitives.serialization import load_der_public_key


def run(ctx):
    if not ctx.selector:
        return None
    published = "".join(ctx.txt(f"{ctx.selector}._domainkey.{ctx.domain}", ctx.authoritative()) or [])
    if not published:
        return None

    raw = re.search(r"(?:^|;)\s*p=([A-Za-z0-9+/=]+)", published)
    if not raw:
        return {"status": "fail", "evidence": "no p= in the record"}
    try:
        key = load_der_public_key(base64.b64decode(raw.group(1)))
        bits = key.key_size
    except Exception:  # noqa: BLE001
        return {"status": "fail", "evidence": "unreadable public key"}

    return {
        "status": "pass" if bits >= 2048 else "warn" if bits >= 1024 else "fail",
        "evidence": f"{bits} bits",
        "params": {"bits": bits},
    }
