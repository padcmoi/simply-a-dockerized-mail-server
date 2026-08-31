# Configuration (root only)

Server-wide settings that belong to nobody's domain: how the manager sends mail,
when it sends notification mail, its own public address, and how long it keeps
the machine's recorded figures. The whole area is
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

## Supervision: how long the machine history is kept

[`/admin/config/supervision`](../../manager-ui/app/pages/admin/config/supervision.vue),
driven by
[`useSupervisionRetention`](../../manager-ui/app/composables/useSupervisionRetention.ts).
One setting, `supervision_retention_ms`: how far back the CPU, load, memory and
network history behind the [Supervision page](server-tools.md) is kept.

It is here and not under the `supervision` ACL resource on purpose. Reading the
machine is a permission; deciding how much of the machine's past this server
stores is a decision about the server, which is what `/config/**` is for.

- **One day to one year**, a week by default. The default is not arbitrary: the
  widest window the cards offer is seven days, so a week is exactly what they
  can draw and anything beyond it costs disk for history no chart reads. Set
  less than that and a card asks for more than exists.
- **The form works in days and stores milliseconds**, and says what the choice
  costs before it is made: one recorded row stands for ten seconds, so a day is
  about 8 640 rows and the default week about 60 000.
- **The purge re-reads it on every pass**, not at boot. It runs once at startup
  and then hourly, so a retention shortened here takes effect at the next purge
  rather than at the next restart. Shortening it deletes what falls outside the
  new window on that pass; nothing is recoverable afterwards.

## Theme: the colours everyone lands on

[`/admin/config/theme`](../../manager-ui/app/pages/admin/config/theme.vue), the
same bench an account gets in its own preferences, pointed at the server-wide
theme instead of a personal one.

Two tables hold the colours, `app_themes` for the server and `account_themes`
for a person, on the same key/value shape as `app_settings` with the mode in
front of the value: light and dark are two themes, not two shades of one, so a
green picked for dark says nothing about light.

- **Both tables ship empty and are meant to stay that way** until someone
  changes a colour. There is no seed, on purpose: what the interface ships with
  is already written in the front, and a seeded row would be a copy of it, wrong
  the day it moves and impossible to tell from a deliberate choice. A token
  nobody set is absent, and absence means the colour the interface was built
  with. That is what makes `Reset` a deletion rather than a rewrite.
- **What is stored is what someone chose**, never what was derived from it: one
  colour per alias, from which the eleven steps Nuxt UI reads are rebuilt in
  CSS, plus the surfaces (backgrounds, borders, text) that are not cut from an
  alias at all.
- **The interface's own server reads the server theme before rendering**
  ([`plugins/theme.ts`](../../manager-ui/app/plugins/theme.ts)) and writes it
  into the page as a stylesheet, so the personalisation is in the first paint
  rather than snapping in after hydration. The answer is held for a minute, so a
  colour changed here is live at the next minute with no restart. `GET
  /config/theme` is the one public route of the namespace, because the login
  screen wears the theme too and there is nobody to authenticate yet. Writing it
  is root, like the rest of `/config`.
- **An account's own theme is read at login and laid over the server's**, token
  by token, and dropped at logout so the next person on that browser gets the
  server's colours rather than the last one's.
