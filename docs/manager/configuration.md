# Configuration (root only)

Server-wide settings that belong to nobody's domain: how the manager sends mail,
when it sends notification mail, and its own public address. The whole area is
**root only**. The API routes under `/config/**` are guarded by
[`RootGuard`](../../manager-api/src/core/auth/root.guard.ts), not by the ACL, so
they never appear in the permission catalogue; the pages carry
`definePageMeta({ rootOnly: true })` and the sidebar shows the Configuration
entry only when `auth.session.isRoot` is true.

[`/config`](../../manager-ui/app/pages/config/index.vue) is a landing page of
cards, one per area below.

## Where it is stored

Two tables, both read-only to everything but this area:

- `mail_settings` -- one row per provider (Brevo, SMTP), one of them marked
  active. Holds the host, port, credentials and the verified sender.
- `app_settings` -- a generic **key/value** store: `key`, `type_field`
  (`enum('number','string')`), `value`, `updated_at`, one row per setting.
  Adding a server-wide option is a new row, not a schema change, which is what
  makes the table reusable.
  [`AppSettingsService`](../../manager-api/src/core/settings/app-settings.service.ts)
  reads every row, casts each `value` by its `type_field`, caches a typed view
  and serves it synchronously, and writes back key by key with an upsert. The
  cache reloads on change, so a new value applies without a restart.

## Mail sending

[`/config/mail`](../../manager-ui/app/pages/config/mail.vue), driven by
[`useMailConfig`](../../manager-ui/app/composables/useMailConfig.ts). It answers
one question: which server does the manager send its mail through (invitations,
notification summaries, verification codes).

Two providers, plus off:

- **Brevo** -- the relay is known (`smtp-relay.brevo.com:587`); you fill in the
  SMTP login, the SMTP key and a verified sender.
- **SMTP** -- any secure mail server worldwide. Host is required, credentials are
  optional (a relay with no authentication is allowed, e.g. the internal
  `mail-postfix:25`).
- **Off** disables outbound mail entirely: nothing is sent and the other mail
  controls lock.

TLS is not a checkbox; it is derived from the port so it cannot be set wrong:
465 means implicit TLS, any other port means STARTTLS, and an authenticated
non-465 host is required to upgrade (`requireTLS`). This is what makes a plain
`587` server connect instead of failing with an SSL "wrong version number".

### Verifying a provider before it goes live

A provider is not trusted on save. The page is a three-step stepper
(Configuration, Verification, Active):

1. Save the config. A six-digit code is mailed to the signed-in root through that
   exact provider config.
2. Enter the code. A correct code validates the provider and makes it the active
   one.
3. Active. The provider is live.

Every step shows a green check when the current provider is validated and a red
cross when it is not, so the stepper doubles as a status light. `POST
/config/mail/select` re-activates an already-validated provider without a new
code; `POST /config/mail/disable` turns mail off while keeping each provider's
validation.

### The stored password never leaves the server

`GET /config/mail` returns a `hasPassword` boolean, never the secret. A
configured provider therefore renders **read-only** (a description list plus a
**Modifier** button) and the password shows as a fixed dotted placeholder, which
is decorative, not the real value. Editing swaps in the inputs with **Valider**
and **Annuler**; leaving the password blank on save keeps the stored one.

## Email cadence

[`/config/mail-cadence`](../../manager-ui/app/pages/config/mail-cadence.vue),
driven by [`useMailCadence`](../../manager-ui/app/composables/useMailCadence.ts).
Three durations, stored in `app_settings`, that used to be environment variables:

- **Delay before the pending-notifications email** -- how long a member must stay
  offline before the summary mail is sent (default 300s).
- **Check frequency** -- how often the sweep looks for members due a summary
  (default 20s).
- **Anti-spam window** -- at most one email per recipient per this many seconds,
  across every kind of mail (default 30s; 0 disables it).

The form works in seconds and stores milliseconds. Cross-field validation, on the
API (`superRefine`) and in the form alike, refuses an anti-spam window or a check
frequency longer than the notification delay. A **Factory defaults** button
restores 300/20/30. On first load the three inputs stay behind a skeleton until
the API answers, so the stored values never flash over the defaults.

See [support.md](support.md) for how these three numbers shape when a member is
actually mailed.

## General: the interface address

[`/config/general`](../../manager-ui/app/pages/config/general.vue), driven by
[`useGeneralConfig`](../../manager-ui/app/composables/useGeneralConfig.ts). The
public address of this manager, used to build the **Open the manager** button in
notification emails. Empty means no button.

It is validated as an origin and nothing more: `http(s)://` followed by a real
domain or subdomain, optional port, with **nothing after the host** (no path,
query or fragment). "Real domain" is enforced against the actual IANA top-level
domain list, so `mail.gestionpratique.ovh` passes while `mail.gestionpartique`
(a plausible-looking but non-existent extension) is rejected.

That list is a single backend catalogue
([`src/core/common/tlds.ts`](../../manager-api/src/core/common/tlds.ts), the IANA
`tlds-alpha-by-domain.txt` lowercased), exposed by `GET /config/general/tlds` so
the form validates the interface address against the **same** set the API does,
without shipping a duplicated copy in the frontend. Both layers filter: the form
disables Enregistrer and shows the error, and the API answers 400.
