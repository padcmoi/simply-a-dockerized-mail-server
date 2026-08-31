"""Two questions, two rows. Merged into one they produce a verdict nobody can
act on: a certificate expiring comfortably in three months, reported under a
sentence that also offers "or does not cover this name".

The certificate is read from its DER bytes rather than from python's parsed
form, because a socket that does not verify its peer hands back nothing parsed,
and this one deliberately does not verify: the question is what the certificate
says, not whether the probe would accept it.
"""

ORDER = 130
ID = "tls-certificate-name"
SECTION = "server"

import datetime

from cryptography import x509
from cryptography.x509.oid import ExtensionOID, NameOID


def _names(cert):
    found = [attr.value for attr in cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)]
    try:
        san = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
        found += san.value.get_values_for_type(x509.DNSName)
    except x509.ExtensionNotFound:
        pass
    # A certificate usually repeats its CN in the SAN list, and a name printed
    # twice reads as two names.
    return list(dict.fromkeys(n.lower() for n in found if n))


def _covers(names, wanted):
    for name in names:
        if name == wanted:
            return True
        if name.startswith("*.") and wanted.endswith(name[1:]):
            return True
    return False


def run(ctx):
    session = ctx.session()
    if not session.reachable or not session.starttls:
        return None

    negotiated = session.certificate or {}
    der = negotiated.get("der")
    if not der:
        return {"status": "fail", "evidence": negotiated.get("error", "no certificate")}

    cert = x509.load_der_x509_certificate(der)
    names = _names(cert)
    wanted = [n for n in [(ctx.mx_host() or "").lower(), (session.helo or "").lower()] if n]
    missing = [n for n in dict.fromkeys(wanted) if not _covers(names, n)]

    days = (cert.not_valid_after_utc - datetime.datetime.now(datetime.timezone.utc)).days
    issuer = next((a.value for a in cert.issuer.get_attributes_for_oid(NameOID.COMMON_NAME)), "")

    return [
        {
            "id": "tls-certificate-name",
            "status": "warn" if missing else "pass",
            "evidence": f"{', '.join(names)} does not cover {', '.join(missing)}" if missing else ", ".join(names),
            "params": {"missing": ", ".join(missing), "names": ", ".join(names)},
        },
        {
            "id": "tls-certificate-expiry",
            "status": "fail" if days <= 0 else "warn" if days < 15 else "pass",
            "evidence": f"{days}d left, issuer {issuer}",
            "params": {"days": days},
        },
    ]
