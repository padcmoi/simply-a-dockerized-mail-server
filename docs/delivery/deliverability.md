# Deliverability: getting accepted by Gmail, Outlook and the rest

Authentication is the ticket in, not the acceptance. SPF, DKIM and DMARC stop
you from being **rejected**; what decides whether you land in the inbox or the
spam folder afterwards is **reputation**, and reputation is not a DNS record.

This document is the checklist, in the order that matters: every block assumes
the previous one is green. Run it top to bottom, and stop reading only when a
check fails.

The manager runs most of these checks for you, per domain, under
**Domain > Deliverability** (`/admin/domains/<domain>/deliverability`). What
follows is what each check means and what to do when it is red.

---

## 1. Network and server identity

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 1.1 | Reverse DNS (PTR) exists | `dig -x <IP>` | a name, not empty |
| 1.2 | FCrDNS: the loop closes | `dig -x <IP>`, then `dig A <name>` | back to the same IP |
| 1.3 | PTR target is not a CNAME | `dig +noall +answer A <PTR name>` | a direct A record |
| 1.4 | HELO/EHLO equals the PTR | `telnet <IP> 25`, read the `220` banner | identical to the PTR |
| 1.5 | Outbound port 25 is open | `nc -vz gmail-smtp-in.l.google.com 25` | connects (many hosts block it) |
| 1.6 | The IP is not in a throwaway pool | reverse-resolve the neighbouring IPs | generic `vps-*`/`static-*` names all around is a bad sign |
| 1.7 | IPv6 is consistent | `dig AAAA` the MX, `dig -x` the v6 | either no IPv6 at all, or PTR + SPF + DKIM as complete as v4 (Gmail is far stricter over IPv6) |

`1.6` deserves a word, because no tool reports it and it is often the whole
answer. Reverse-resolve the addresses around yours: if every neighbour carries
a generic hosting name, you are renting an address in a range that is scored as
a block, and no record of yours changes the neighbourhood.

## 2. Authentication DNS

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 2.1 | MX resolves to a reachable IP | `dig MX <domain>`, `dig A <mx>` | yes |
| 2.2 | Exactly one SPF record | `dig +short TXT <domain>` | one `v=spf1` (two is invalid, guaranteed failure) |
| 2.3 | SPF covers the sending IP | read `ip4:` / `mx` / `include:` | the outbound IP is authorised |
| 2.4 | SPF stays under 10 DNS lookups | count `include`, `a`, `mx`, `redirect` | 10 or fewer, else `permerror` |
| 2.5 | SPF qualifier | end of the record | `-all` when every source is known, `~all` otherwise |
| 2.6 | The `_domainkey` node exists | `dig +noall +comments TXT _domainkey.<domain> @<authoritative NS>` | `NOERROR` (`NXDOMAIN` means no key at all) |
| 2.7 | Which selector is actually signing | read `s=` in a real message's `DKIM-Signature` | never guess a selector |
| 2.8 | That selector has a TXT record | `dig +short TXT <s>._domainkey.<domain>` | `v=DKIM1; k=rsa; p=...` |
| 2.9 | The key is valid and 2048 bits | extract `p=`, `openssl rsa -pubin -inform DER -noout -text` | loads, 2048 bits |
| 2.10 | No `t=y` (test mode) | read the TXT | absent, otherwise verifiers ignore the result |
| 2.11 | DMARC exists | `dig +short TXT _dmarc.<domain>` | `v=DMARC1; p=...` |
| 2.12 | DMARC policy and alignment | read `p=`, `sp=`, `adkim=`, `aspf=` | `p=none` to start, tighten **after** DKIM is confirmed passing |
| 2.13 | The `rua` address receives | send to it | reports arrive; they are your only automatic feedback |
| 2.14 | MTA-STS | `dig TXT _mta-sts.<domain>` and `curl https://mta-sts.<domain>/.well-known/mta-sts.txt` | both answer, or accept its absence |
| 2.15 | TLS-RPT | `dig +short TXT _smtp._tls.<domain>` | `v=TLSRPTv1; rua=...` |
| 2.16 | DANE/TLSA (only with DNSSEC) | `dig TLSA _25._tcp.<mx>` | matches the certificate, or nothing at all |
| 2.17 | No wildcard TXT polluting lookups | `dig TXT anything.<domain>` | `NXDOMAIN` |

**The trap that catches everyone (2.6 to 2.8).** A DKIM selector can be named
anything, so probing likely names proves nothing: query the **rcode of the
`_domainkey` node itself** on the authoritative server. `NOERROR` means
something exists below it, `NXDOMAIN` means there is no key. Then read the
`s=` value from a real message to learn which selector is signing today.

That distinction matters because of a specific failure: this project rotates
DKIM selectors monthly (`dkim<YYYYMM>`, see
[`images/opendkim/dkim-api.py`](../../images/opendkim/dkim-api.py)). Regenerate
a key without publishing the new record, and the server signs with a selector
that has **no DNS record**. An unverifiable signature is worse than no
signature: it reads as an impersonation attempt, and with `p=quarantine` your
own policy sends the mail to spam. The manager's Deliverability page compares
the selector it signs with against what DNS actually serves, which is exactly
this check.

## 3. The server itself

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 3.1 | STARTTLS advertised | `EHLO` on port 25 | `250-STARTTLS` |
| 3.2 | Certificate valid, CN matches the HELO | `openssl s_client -starttls smtp -connect <ip>:25` | not expired, name matches |
| 3.3 | TLS 1.0/1.1 disabled | `smtpd_tls_protocols` | `!TLSv1, !TLSv1.1` |
| 3.4 | Not an open relay | external sender to external recipient | refused (an open relay is blacklisted within hours) |
| 3.5 | Locally generated mail is signed too | `non_smtpd_milters` includes OpenDKIM | yes: cron, sieve and notification mail is otherwise unsigned |
| 3.6 | The signing selector equals the published one | compare the OpenDKIM config with DNS | see the trap above |
| 3.7 | `postmaster@` and `abuse@` exist | send to them | RFC 2142; some filters test them |
| 3.8 | The queue is healthy | `postqueue -p` | no pile of bounces, which is what a compromised server looks like |

## 4. Reputation, which is not configuration

| # | Check | Where |
| --- | --- | --- |
| 4.1 | IP blacklists | check.spamhaus.org, mxtoolbox.com/blacklists, barracudacentral.org, **from their own site**: public resolvers are refused by these services |
| 4.2 | Domain blacklists (DBL/SURBL) | Spamhaus DBL, surbl.org |
| 4.3 | IP score | senderscore.org, talosintelligence.com |
| 4.4 | What Google thinks | **Google Postmaster Tools**: IP reputation and domain reputation, two separate curves |
| 4.5 | What Microsoft thinks | SNDS (IP data) plus JMRP (complaints) |
| 4.6 | Whitelisting | register at dnswl.org |
| 4.7 | The IP's past | was this address a spammer's before it was yours |

There is no form anywhere that adds you to an inbox whitelist. What stands in
for it is: registering with the postmaster programmes so you have data at all,
getting delisted from whatever blocks you, listing on public DNS whitelists,
and having real recipients mark your mail as **not spam**, add you to their
contacts and **reply** to you. The last one is the strongest signal that
exists, and the least used.

## 5. End to end, the only verdict that counts

| # | Check | How |
| --- | --- | --- |
| 5.1 | mail-tester.com | send to it, aim for 10/10, read every deducted point |
| 5.2 | Gmail "Show original" | `Authentication-Results`: `spf=pass`, `dkim=pass`, `dmarc=pass` |
| 5.3 | The `s=` matches DNS | in the same message's `DKIM-Signature` header |
| 5.4 | The classification | inbox or spam, and Gmail's yellow banner sometimes states the reason |
| 5.5 | Same test on Outlook.com and Yahoo | all three filter differently |
| 5.6 | Test after a forward | forward the message elsewhere: SPF breaks, only DKIM survives, which is where a broken DKIM finally shows |
| 5.7 | learndmarc.com or dmarcian | a full visualisation of the chain |

**How to read the outcome.** Sections 1 to 3 must be green before section 4 is
worth looking at, and 5.2 with 5.3 are what separate "a configuration problem"
from "a reputation problem". If everything is green through 5.3 and the mail
still lands in spam, the cause is in section 4, and it will not be fixed in a
configuration file.

## When everything is done and it still goes to spam

This is a real situation, not a hypothetical, and a self-hosting guide owes its
reader an honest answer rather than another record to add.

On a hosting provider's VPS, perfect authentication does not buy the inbox. Your
IP sits in a range that is scored as a block, your volume is too low and too
irregular for a positive reputation to build, and without engagement signals
(opens, replies, contacts) the filter has nothing that argues in your favour.
That state is stable: it does not get worse, and it does not improve on its own.

Three honest ways out, in order of effect:

1. **Relay outbound mail through a reputable smarthost.** Your provider's relay,
   or Brevo, Mailgun, Postmark, SES. You keep your domain, your DKIM signature
   and your identity; you borrow nothing but the IP reputation. In Postfix it is
   a `relayhost` plus SASL credentials, an `include:` in your SPF, and inbound
   mail stays with you. This is the only lever that reliably changes the outcome
   once everything else is done.
2. **Ask the provider for a different IP.** Free to try, but a lottery: you often
   land in the same pool. Worth it only when Postmaster Tools shows genuinely bad
   IP reputation rather than "no data".
3. **Engagement and rhythm.** Have your regular correspondents mark "not spam",
   add the address to their contacts and reply; send regularly rather than in
   bursts; register with dnswl.org.

Choosing a relay is not an admission of failure. It is the difference between a
server that authenticates correctly and a server whose mail is read.
