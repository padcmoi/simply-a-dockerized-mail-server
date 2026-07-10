# Documentation index

Useful references for the mail stack -- one folder per feature. Each
`README.md` answers four questions: how does the feature behave end to
end, where does the code live, what knobs are exposed, and how to debug
or test it.

## Read in this order

1. [delivery/](delivery/) -- **start here**: how a mail moves through the
   stack from the public SMTP port to a user's mailbox, including the
   exact order of milter checks, sieve scripts and fallbacks. Every other
   document refers back to a step from this diagram.
2. [sieve/](sieve/) -- sieve mechanics in detail: `sieve_before`,
   `sieve_default`, the per-user managesieve script and the four
   `imap_sieve` triggers (Junk learn-spam, ham, AUTOROUTER create,
   AUTOROUTER undo).
3. [autorouter/](autorouter/) -- per-sender auto-routing driven by IMAP
   moves: rules visible in Roundcube's Filtres UI, create/update/undo
   semantics, system-folder safety.
4. [spam/](spam/) -- USER_BLOCKLIST + GLOBAL_BLOCKLIST + per-user bayes
   - postmaster notification. The full chain that turns three drag-to-
     Junk events into automatic spam routing for everyone.
5. [antivirus/](antivirus/) -- ClamAV scanning at milter time, EICAR
   reject path, what happens to attachments that get blocked.
6. [dkim/](dkim/) -- outbound DKIM signing, the in-container sidecar API
   (`dkim-api.py`) and how install.sh / manager-api use it.
7. [quota/](quota/) -- per-user and per-domain quota live tracking via
   the five MariaDB triggers.
8. [auth/](auth/) -- SMTP / IMAP / ManageSieve authentication,
   `sender_login_maps`, password hashing.
9. [operations/](operations/) -- running concerns: bind-mounted volumes,
   TLS rotation, cold-start behaviour, fail2ban known issue.
10. [test/](test/) -- the `./test-mailservers.sh` end-to-end suite that
    pins every feature above.
11. [api/acl.md](api/acl.md) -- control plane, not mail: manager-api's
    permission model. Resources, the named action each one offers (no
    generic `read`/`create`/`modify`/`delete` anywhere), the root and
    domain-owner bypasses, and a generated table of every API route with
    the exact permissions it demands.

## Conventions used throughout the docs

- Code paths are relative to the project root and **clickable** (markdown
  links). Example: [`images/dovecot/conf/sieve/auto-route.sieve`](../images/dovecot/conf/sieve/auto-route.sieve).
- Container names follow the `mail-<service>` convention; if a doc says
  `mail-dovecot`, run `docker exec mail-dovecot <cmd>` from the host.
- `${VOLUMES_PATH}` defaults to `./volumes` and holds every piece of
  runtime state (no docker-managed named volumes).
- Anything that mentions `manager-api` or `manager-ui` describes the
  control plane -- the mail backends documented here keep working even
  when those services are down.
