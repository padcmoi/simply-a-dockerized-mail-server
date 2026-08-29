"""What a receiver compares is the announced HELO against the reverse name of
the address talking to it, not against the MX. The MX is where mail is delivered
TO, and a server may legitimately send under another name, so the PTR is the
reference. Announcing the MX name instead is a remark; announcing a name that
belongs to neither is a fault."""

ORDER = 110
ID = "helo-matches-ptr"
SECTION = "server"


def run(ctx):
    session, ptr = ctx.session(), ctx.ptr_name()
    if not session.reachable or not ptr:
        return None

    helo = (session.helo or "").lower()
    mx = (ctx.mx_host() or "").lower()
    evidence = f"HELO {helo or '-'}, PTR {ptr}"
    params = {"helo": helo, "ptr": ptr}

    if not helo or "." not in helo:
        return {"status": "fail", "evidence": evidence, "params": params}
    if helo == ptr.lower():
        return {"status": "pass", "evidence": evidence}
    if helo == mx:
        return {"status": "warn", "evidence": f"{evidence}, MX {mx}", "params": params}
    return {"status": "fail", "evidence": evidence, "params": params}
