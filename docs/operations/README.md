# Operations

Day-to-day running concerns: where state lives, how TLS rotates without
touching the host, what to watch on cold start, and the only known
restart-loop in the stack.

## State on disk

Everything stateful is a bind-mount under `${VOLUMES_PATH}` (defaults
to `./volumes`). No docker-managed named volumes -- a `docker volume
prune -af` does not affect this stack any more.

```
${VOLUMES_PATH}/
  mail/         -- Maildirs: ${VOLUMES_PATH}/mail/<domain>/<user>/(cur|new|tmp|sieve|...)
  mysql/        -- MariaDB datadir
  redis/        -- AOF + RDB. Holds bayes tokens, spam_count, senders sets, notified flags. See spam/.
  postfix-spool/-- postfix queues
  opendkim/     -- private keys + KeyTable/SigningTable
  opendmarc/    -- opendmarc state
  rspamd/       -- learned bayes + rspamd internal state (note: bayes also has redis-backed per-user tokens; the FS state here is the global classifier)
  clamav/       -- signature database (freshclam keeps it updated)
  fail2ban/     -- ban state
  log/          -- dovecot.log + postfix.log (shared, bind-mounted r/w in dovecot/postfix, r/o in fail2ban)
```

Snapshotting `${VOLUMES_PATH}` (e.g. via LVM or restic) is the supported
backup method. Quiesce delivery first with
`docker compose stop postfix dovecot` to avoid catching half-written
Maildir files.

The migration from the docker-managed `redis_data` volume to the
bind-mount is documented in commit `bf3a373`. Existing installs:

```
docker compose stop redis
sudo mkdir -p volumes/redis
sudo tar -C /var/lib/docker/volumes/simply-mailserver_redis_data/_data/ -cf - . \
  | sudo tar -C volumes/redis/ -xf -
docker compose up -d redis
docker volume rm simply-mailserver_redis_data
```

## TLS

- The Let's Encrypt cert lives **on the host**, at the path
  `${TLS_LETSENCRYPT_PATH}` from `.env`.
- Dovecot and postfix bind-mount that directory **read-only** as
  `/etc/letsencrypt`.
- `cert-watcher.sh` runs as a sidecar process in the dovecot and postfix
  containers. It watches the live cert dir with `inotifywait`. When
  certbot rotates the certificate on the host, the watcher fires
  `kill -TERM 1` and docker's `restart: unless-stopped` policy brings
  the container back with the fresh fullchain / privkey.
- Nothing TLS-related is ever installed on the host outside the
  project directory.

`cert-watcher.sh` source:
[`images/dovecot/cert-watcher.sh`](../../images/dovecot/cert-watcher.sh)
and [`images/postfix/cert-watcher.sh`](../../images/postfix/cert-watcher.sh).

## Cold-start behaviour

Before commit `1bbc7ae`, a fresh `docker compose up` could leave the
whole stack stuck on `dependency failed to start: container mail-dovecot
is unhealthy`. Root cause: the entrypoint ran
`openssl dhparam -out /etc/dovecot/dh.pem 2048` which takes 20-90 s on
a typical VPS, while the healthcheck `start_period` was 15 s.

Current behaviour:

- The Dockerfile bakes `dh.pem` at build time -- `RUN openssl dhparam
-out /etc/dovecot/dh.pem 2048`. The cold-start path no longer pays
  this cost.
- The entrypoint keeps a defence-in-depth `if [ ! -s
/etc/dovecot/dh.pem ]; then openssl dhparam ...` for the case where
  the file is somehow empty.
- The healthcheck `start_period` is bumped to 60 s, which absorbs every
  other plausible cold-start delay (sieve recompile, vmail chown on a
  freshly mounted volume, cert-watcher launch). Observed steady state:
  dovecot reports healthy ~1 s after the container starts.

## Logs

- **Dovecot** -- `${VOLUMES_PATH}/log/dovecot.log` (bind-mounted).
  Searchable in real time with
  `docker exec mail-dovecot tail -f /var/log/mail/dovecot.log`.
- **Postfix** -- `${VOLUMES_PATH}/log/postfix.log` (same bind mount).
  `docker exec mail-postfix tail -f /var/log/mail/postfix.log`.
- **Rspamd** -- `docker logs mail-rspamd 2>&1 | tail -100`. Look for
  `info; <msg-id>; ...; ACTION:` lines to see the decision per mail.
- **manager-api** -- `docker logs mail-manager-api`. JSON Pino-style.
- **Roundcube** -- `docker logs mail-roundcube`. Apache + PHP error
  log.

A `docker compose logs -f <service>` shortcut is exposed via
[`service.sh`](../../service.sh): `./service.sh logs dovecot`.

## Known issues

| symptom                                                                                         | scope                  | mitigation                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mail-fail2ban` restart-loops on a freshly built image                                          | fail2ban-server config | the shipped `sshd-ddos` jail expects `/var/log/messages` which does not exist in the Alpine container. Tracked as a SKIP in `tests/01-infra.sh`; does not block mail delivery (postfix / dovecot have their own brute-force rate limits). Fix in flight: drop the `sshd-ddos` jail from the alpine variant. |
| `mailbox dovecot/sieve: stat ... .dovecot.sieve/tmp: No such file or directory` in dovecot logs | spurious               | the `.dovecot.sieve` symlink at the mailbox root is mis-detected as a mailbox directory by some `doveadm` calls. Harmless. Tracked but not user-facing.                                                                                                                                                     |

## Routine commands

| task                          | command                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| bring the stack up            | `./service.sh up` (= `docker compose --profile antivirus up -d --build`) |
| stop everything, keep volumes | `./service.sh down`                                                      |
| restart one service           | `./service.sh restart` or `docker compose restart <svc>`                 |
| shell in a service            | `./service.sh exec dovecot`                                              |
| run the end-to-end tests      | `./test-mailservers.sh` -- writes `test-results.md`                      |
| run install.sh                | `./service.sh install` -- bootstrap on a fresh host                      |

## Where to read next

- [delivery/](../delivery/README.md) for the data path one mail takes.
- [spam/](../spam/README.md) for what to look at in Redis when
  USER_BLOCKLIST behaviour is suspicious.
- [test/](../test/README.md) for the end-to-end suite that should pass
  on every restart.
