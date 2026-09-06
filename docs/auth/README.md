# Authentication

One MariaDB-backed identity store, three protocols (SMTP submission,
IMAP, ManageSieve), and a strict sender-login binding that prevents a
compromised user from spoofing peers.

## Tables involved

- **`Accounts`** -- the admin / staff users that log in to
  manager-ui (`bcrypt` password). Not mailboxes.
- **`VirtualUsers`** -- the actual mailboxes. `password` is
  `{SHA512-CRYPT}` (matches v1 production for zero-cost migration).
- **`VirtualDomains`** -- the domain each mailbox lives in.
- **`VirtualAliases`** -- forwarding-only addresses; resolve to a
  VirtualUsers email.
- **`RefreshTokens`** -- manager-api JWT refresh tokens. Out of scope
  for the mail backends.

`VirtualUsers.password` example:

```
{SHA512-CRYPT}$6$Bnn9dijW5P18fW9Q$Jht2eHhumKsmGxqzIsANa.9shi/Stk0UzwTYh4vXFBH3FJSBsuixoS59ST4zLgmuDoDqq6sjTbxnJN7i9uQxh1
```

Hashed by the manager-api via `openssl passwd -6` (= SHA512-CRYPT) at
write time. Dovecot's `auth_default_realm` + `dovecot-sql.conf.ext`
binds this column to the auth lookup.

## The Cyrus SASL passthrough

Postfix does not talk to MariaDB directly for SASL. It exposes the
dovecot `auth` UNIX socket through `smtpd_sasl_path = inet:dovecot:12345`
in [`main.cf`](../../images/postfix/conf/main.cf), so a SASL AUTH PLAIN
on port 587 / 465 is the **same lookup** as an IMAP LOGIN on port 993.

Why it matters:

- A single password change in `VirtualUsers.password` updates SMTP, IMAP
  and ManageSieve at once.
- Brute-force protection (Dovecot's `auth_failure_delay` +
  `auth_anonymous_username`) covers SMTP submission too.

## sender_login_maps

[`main.cf`](../../images/postfix/conf/main.cf):

```
smtpd_sender_restrictions =
  permit_mynetworks,
  permit_sasl_authenticated,
  reject_sender_login_mismatch,
  reject_unverified_sender
smtpd_sender_login_maps = mysql:/etc/postfix/sql/sender_login_maps.cf
```

The SQL view returns every (alias_or_real_address, owner_email) pair so
postfix can verify that an AUTH'd user only sends as their own address
or one of their aliases. `MAIL FROM:<charlie@example.com>` while AUTH'd
as `alice@example.com` -> `553 5.7.1 Sender address rejected:
not owned by user alice@example.com`.

## Ports and protocols

| port  | service              | binding     | what runs                                                                                                |
| ----- | -------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| 25    | postfix smtpd        | host        | inbound SMTP from anywhere. Milter chain active. AUTH disabled.                                          |
| 465   | postfix smtps        | host        | submission over implicit TLS. AUTH required.                                                             |
| 587   | postfix submission   | host        | submission over STARTTLS. AUTH required.                                                                 |
| 993   | dovecot imaps        | host        | IMAP over TLS.                                                                                           |
| 4190  | dovecot managesieve  | bridge only | sieve script management. Reachable from `mail-roundcube` and other bridge containers, not from the host. |
| 10025 | postfix internal     | bridge only | milter-free relay for sieve DSNs and the postmaster notification. mynetworks only.                       |
| 12340 | dovecot quota-status | bridge only | postfix policy lookup -- see [quota/](../quota/README.md).                                               |
| 12345 | dovecot auth socket  | bridge only | what postfix SASL talks to.                                                                              |

## Manager-api authentication

Out of scope for the mail backends, but worth noting:

- `Accounts` rows authenticate against `manager-api` via username +
  bcrypt.
- A successful login returns a short-lived JWT + a refresh token (in
  `RefreshTokens`).
- The refresh token rotates on every use to limit blast radius if the
  client is compromised.

The mail stack does **not** consume manager-api auth -- a dead
manager-api leaves mail working. Manager-api can be rebooted without
disconnecting any user.

### Sign-in from far away

A stolen password opens a session from anywhere, so every sign-in is
measured against the place the account usually signs in from. Two
points and a radius, nothing more:

- **The account's usual place** -- `account_mfa.login_latitude` /
  `login_longitude`, one row per account at most, next to the security
  question below. Every session that opens moves the point to where it
  opened (`JwtAuthService.finishSession`), so it walks with its owner.
  The first sign-in poses it and is never challenged. Never
  `account_profiles`: the coordinates there are the profile's own city,
  geocoded by Nominatim, and this check neither reads nor writes them.
- **Where the sign-in comes from** -- the IP, resolved locally by
  `fast-geoip` (`core/common/geoip.ts`, `locationOf`), the dataset the
  access trails already use. No network call, no third party, no file
  to refresh. Private ranges, loopback and the docker bridge resolve to
  nothing, and nothing is ever blocked on a missing point.
- **The radius** -- `login_radius_km` in `app_settings`, 100 by default,
  0 turns the check off. Widened to the accuracy the dataset admits to
  (`max(radius, area)`): a residential French range resolves to Paris
  with `area` 1000, and comparing two such points to within 100 km would
  challenge a move across town. Both points come from the same dataset,
  so the bias cancels.

Past the radius (`LoginRiskService.isFar`, great-circle distance in
`core/common/haversine.ts`) the password alone is not a session:

1. **The authenticator app**, when the account has one -- first, and
   alone. Its code already answers the distance, nothing is asked on
   top of it. The journal still records the sign-in as far away.
2. Otherwise **the security question** or **a six-digit code by mail**,
   in the order `login_challenge_order` holds (`question,email` by
   default, root-settable on `/admin/config/login-risk` beside the
   radius). The order is a preference: whatever cannot be offered (no
   outbound mail configured, no question chosen) stands aside for the
   other, and the login screen offers the other way under the form
   whenever the server can actually provide it.
3. Neither available: the session opens and the journal says so
   (`auth.login.far` with `method: none`). Refusing would lock the owner
   of a server with no mail out of their own manager.

The challenge in between is the two-factor store's shape
(`mfa-challenge.store.ts`): an opaque string worth nothing to the auth
guard, ten minutes, five tries, the mailed code kept as a keyed hash.
Switching a live challenge between the code and the question
(`POST /auth/jwt/login/mfa/method`) keeps its identifier, its deadline
and the tries already spent, so it changes the proof and never buys a
fresh set of guesses.

**The security question** is one of five keys (`SECURITY_QUESTIONS`:
father's first name, mother's maiden name, paternal grandfather's and
maternal grandmother's first names, town of birth), facts fixed for life
whose answer is a proper name. The answer is normalised (case, accents,
spacing) and stored as HMAC-SHA256 keyed with
`security-answer:` + `MANAGER_API_TOKEN_PEPPER`; the API returns the
question, never the answer, and five wrong answers shut it for fifteen
minutes. Every account is made to choose one, once: `SecurityQuestionGuard`
(second `APP_GUARD`) refuses every session route except reading or
setting the question and `GET /auth/jwt/me` until it has one, the
interface shows a modal that nothing closes but answering it, and a
second `PUT` is refused with 409. An API key is never stopped: it acts
for a machine that will never see a question. The only way back for an
owner who forgets their answer is an administrator's:
`DELETE /accounts/:id/security-question` (`accounts:edit-account`)
clears it and revokes every live session of the account, so its next
sign-in asks for a new one.

Routes, all under `/api/v1`:

| route                                        | auth                    | what                                                                |
| -------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| `POST /auth/jwt/login/mfa`                   | public                  | `{ challenge, answer }` -> the same token pair a plain sign-in gets |
| `POST /auth/jwt/login/mfa/resend`            | public                  | a fresh code, paced by `mail_min_interval_ms`                       |
| `POST /auth/jwt/login/mfa/method`            | public                  | `{ challenge, method }` -> the same challenge, proved the other way |
| `GET` / `PUT /auth/jwt/me/security-question` | JWT                     | read (never the answer) / choose, once                              |
| `DELETE /accounts/:id/security-question`     | `accounts:edit-account` | clear it and sign the account out everywhere                        |
| `GET` / `PUT /config/login-risk`             | root                    | the radius and the order                                            |

Every step leaves a line in the activity log: `auth.login.far` (distance,
threshold and what was asked), `auth.mfa.refused`,
`auth.security-question.set` and `.reset`. Details and the reasoning
behind each choice: [`.trash/FEATURES/login-risk.md`](../../.trash/FEATURES/login-risk.md).

## Password rotation playbook

Via manager-api (recommended):

```
PATCH /api/users/:id { "password": "newpass" }
```

The api hashes with `openssl passwd -6`, UPDATEs `VirtualUsers.password`.
Dovecot's auth cache is short-lived (`auth_cache_ttl = 1 hour` by
default, drops to 0 on a `doveadm reload`). For an immediate effect:

```
docker exec mail-dovecot doveadm reload
```

Manually in the DB (emergency only):

```sql
UPDATE VirtualUsers
SET password = CONCAT('{SHA512-CRYPT}', SUBSTRING_INDEX('${HASH}', '{SHA512-CRYPT}', -1))
WHERE email = 'user@example.com';
```

where `${HASH}` is the output of `openssl passwd -6 -salt rngsalt newpass`.

## Brute-force protection

Two layers:

- **fail2ban** -- watches the dovecot + postfix logs and bans an IP
  after `maxretry` (default 6) auth failures in `findtime` (default 10
  min). Bans for `bantime` (default 1 hour). Configured in
  [`images/fail2ban/`](../../images/fail2ban/) -- known issue: the
  shipped `sshd-ddos` jail expects `/var/log/messages` which does not
  exist in our Alpine container, causing fail2ban to restart-loop on a
  freshly built image. Tracked separately; documented as a SKIP in
  [test/](../test/README.md).
- **dovecot built-in** -- `auth_failure_delay = 2s` slows down a
  brute-force attacker even before fail2ban kicks in. Set in
  [`90-master.conf`](../../images/dovecot/conf/conf.d/90-master.conf).

## How it is tested

[`tests/02-auth.sh`](../../tests/02-auth.sh):

- `smtp.auth.587` -- AUTH PLAIN over STARTTLS works.
- `smtp.auth.465` -- AUTH PLAIN over implicit TLS works.
- `imap.login.993` -- IMAP LOGIN works.
- `managesieve.banner` -- the managesieve service is reachable on
  port 4190 from inside the bridge.

[`tests/03-delivery.sh`](../../tests/03-delivery.sh) implicitly covers
`sender_login_maps`: the test sends as `at1@<domain>` while AUTH'd as
`at1@<domain>`. A misconfigured `sender_login_maps` would 553 here.
