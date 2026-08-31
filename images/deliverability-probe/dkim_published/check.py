"""The trap this stack can walk into: it rotates selectors monthly, and a key
regenerated without publishing the new record makes the server sign under a
selector DNS does not know. An unverifiable signature is worse than none, and
with p=quarantine the domain's own policy sends the mail to spam.

The selector is not guessed: the manager passes the one it signs with."""

ORDER = 310
ID = "dkim-published"
SECTION = "dns"


def run(ctx):
    if not ctx.selector:
        return {"id": "dkim-selector-known", "status": "fail"}

    name = f"{ctx.selector}._domainkey.{ctx.domain}"
    published = "".join(ctx.txt(name, ctx.authoritative()) or [])
    known = {"id": "dkim-selector-known", "status": "pass", "evidence": ctx.selector}
    if not published:
        return [known, {"status": "fail", "evidence": name, "params": {"selector": ctx.selector}}]

    shown = published[:60] + ("..." if len(published) > 60 else "")
    return [known, {"status": "pass", "evidence": shown}]
