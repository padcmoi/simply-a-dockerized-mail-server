# DKIM

DKIM keeps two responsibilities separated:

- the **opendkim milter** signs outbound mail and verifies inbound mail
  at SMTP time (driven by postfix).
- a **tiny HTTP sidecar** running in the same container exposes
  generate / list / rotate / delete operations on the keys, consumed by
  both `install.sh` (initial bootstrap) and `manager-api` (everyday
  domain management).

## Where each piece lives

| concern                                                 | path                                                                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| opendkim daemon + milter config                         | [`images/opendkim/`](../../images/opendkim/)                                                                                                    |
| Sidecar HTTP API                                        | [`images/opendkim/dkim-api.py`](../../images/opendkim/dkim-api.py)                                                                              |
| Postfix milter hookup                                   | [`images/postfix/conf/main.cf`](../../images/postfix/conf/main.cf) (`smtpd_milters = inet:opendkim:8891 inet:opendmarc:8893 inet:rspamd:11332`) |
| Persistent state (private keys, KeyTable, SigningTable) | `${VOLUMES_PATH}/opendkim/` -- bind-mounted                                                                                                     |

## Signing pipeline (outbound)

```
authenticated user -> postfix submission (587/465)
                       |
                       | milter chain
                       v
                +---------------+
                |  opendkim     |  picks the active selector for the
                |  inet:8891    |  sender domain via SigningTable, signs
                +---------------+  with the matching private key in
                       |          KeyTable, adds the DKIM-Signature
                       |          header.
                       v
                +---------------+
                |  opendmarc    |  records the alignment result so the
                |  inet:8893    |  Authentication-Results header is
                +---------------+  consistent with whatever happens
                       |          downstream.
                       v
                +---------------+
                |  rspamd       |  outbound scoring catches a
                |  inet:11332   |  compromised account before it floods
                +---------------+  external recipients.
                       |
                       v
                  postfix smtp -> remote MX
```

## Verification pipeline (inbound)

Mirror image. opendkim reads the inbound `DKIM-Signature`, fetches the
public key from DNS, and replies with `Authentication-Results: dkim=pass`
(or `fail` / `none`). opendmarc consumes the dkim result + an SPF check
to evaluate DMARC alignment. The result tags reach rspamd, which uses
them in scoring (so a DMARC fail with policy=reject contributes to
spam classification, not to an SMTP-time reject -- see
[delivery/](../delivery/README.md)).

## The sidecar API

The Python script runs `opendkim-genkey` for new selectors, edits
KeyTable / SigningTable atomically, signals opendkim to reload (`kill
-USR1 $(cat /var/run/opendkim/opendkim.pid)`), and returns the result.

| route                                    | what it does                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `POST /generate`                         | create a new domain. Generates a `dkimYYYYMM` selector, returns the TXT record the user must publish. |
| `GET /list?domain=<d>`                   | list every selector known for the domain.                                                             |
| `POST /rotate`                           | add a fresh selector without removing the previous one (DNS-rotation friendly).                       |
| `DELETE /delete?domain=<d>&selector=<s>` | remove a stale selector after the TTL has expired.                                                    |

It listens only on the docker mail bridge (`http://mail-opendkim:8080`)
-- no host port mapping. Consumers:

- **install.sh** -- bootstrap the first domain on a fresh install.
- **manager-api** -- domain CRUD: `POST /api/domains`, `GET /api/domains/:id/dkim`,
  `POST /api/domains/:id/dkim/rotate`, `DELETE /api/domains/:id/dkim?selector=...`.

The selector pattern is `dkim<YYYYMM>` (ascii pure, no underscore) so
even strict DNS UIs and legacy DKIM validators accept it.

## How to publish a generated TXT

The sidecar response includes a `Value` field. Publish it as a TXT
record at:

```
<selector>._domainkey.<domain>     IN TXT  "<value>"
```

`install.sh` writes the exact line into `INSTALL_INFO.txt` for the
primary domain so the admin can copy-paste during the initial setup.
The value is wrapped in double quotes (fix `bd23ac3`) so registrars
that strip surrounding quotes do not break the record.

## Key rotation playbook

1. `POST /api/domains/:id/dkim/rotate` -- a new selector appears,
   opendkim starts signing with it immediately.
2. The previous selector stays valid (still in KeyTable, still resolved
   by DNS).
3. Wait `max(DNS_TTL, ~5 days)` so every cached signature from the old
   selector has been verified or expired in flight.
4. `DELETE /api/domains/:id/dkim?selector=<old>` -- removes the entry
   from KeyTable / SigningTable. opendkim reloads.

## How to debug

- `docker exec mail-opendkim cat /etc/opendkim/KeyTable` -- which keys
  exist.
- `docker exec mail-opendkim cat /etc/opendkim/SigningTable` -- which
  selector signs which domain.
- `docker exec mail-opendkim opendkim-testkey -d <domain> -s
<selector> -k /var/db/dkim/<domain>.private` -- offline check that
  the private key matches the published TXT.
- `docker logs mail-opendkim 2>&1 | tail -50` -- signing decisions per
  outgoing mail.
- send a mail to `mail-tester.com` or `check-auth@verifier.port25.com`
  for a third-party verdict.

## How it is tested

[`tests/03-delivery.sh`](../../tests/03-delivery.sh):

- `dkim.signature_header` -- the outbound mail has a
  `DKIM-Signature:` header.
- `dkim.api.sidecar` -- the sidecar responds on
  `http://mail-opendkim:8080/list?domain=<TEST_DOMAIN>`.
