# Installation

End-to-end bootstrap of the v2.0.0 mail server on a fresh host. Migrating from
1.x.x prod ? Read [MIGRATION.md](MIGRATION.md) first, then come back here.

## Prerequisites

- Linux host (Debian 11/12 or Alpine, any distro with Docker works)
- Docker 24+ and the `docker compose` plugin
- Ports `25 / 143 / 465 / 587 / 993` reachable from the internet
- A public IP with a clean reputation (no listing on Spamhaus / Barracuda)
- Reverse DNS (PTR) on the public IP set to the server's HELO hostname (see
  [DOMAIN_DNS.md](DOMAIN_DNS.md) for the PTR section)
- Letsencrypt certificate already issued for the server hostname (optional but
  recommended ; `install.sh` will pick it up from `/etc/letsencrypt/live/<fqdn>/`)

## 1. Clone and configure

```bash
git clone <repo-url> /var/docker/mail-server
cd /var/docker/mail-server
cp .env.sample .env
```

Edit `.env` and fill at minimum :

```env
DOMAIN_FQDN=mail.example.com          # the server's HELO hostname, must match the PTR
ADRESSIP=203.0.113.10                  # the server's public IP
ADMIN_PASSWORD=YourStrongPass123!      # 12+ chars with upper, lower, digit
DOCKER_VOLUMES=./volumes                # where docker volumes live on the host
AUTH0_DOMAIN=                          # leave empty if you don't use Auth0 SSO
AUTH0_AUDIENCE=
AUTH0_ISSUER=
```

Everything else has sensible defaults in `.env.sample`.

## 2. Run the installer

```bash
./install.sh
```

What it does, in order :

1. Validates `.env` (required vars present, `ADMIN_PASSWORD` strong enough).
2. Generates persistent secrets in `.secrets/` (gitignored) :
   - `system_password` - MariaDB root, 50 chars
   - `roundcube_des_key` - Roundcube cookie encryption, 24 chars
   - `root_jwt_secret` - manager-api HS256 signing key, 64 hex chars
3. Prompts for the **root account email** (the manager-api super-admin).
4. Generates a 24-char root password **in memory**, SHA512-CRYPT hashes it,
   writes the INSERT into `runtime/config/mariadb/init/99_manager_api_auth.sql`
   so it lands in `Accounts` on first MariaDB boot.
5. Hydrates `templates/` into `runtime/config/` (sed substitutions of `____PLACEHOLDERS`
   from `.env`).
6. Prepares `volumes/` directories with the right permissions.
7. Syncs Letsencrypt certs from `/etc/letsencrypt/live/<DOMAIN_FQDN>/` into the
   ssl volume if available.
8. Prints the root email + password **exactly once** at the end. Copy them
   immediately, they are not written anywhere on disk.

Sample output :

```
[+] .env loaded - FQDN=mail.example.com IP=203.0.113.10
[+] Generated SYSTEM_PASSWORD (mariadb root, 50 chars)
[+] Generated Roundcube DES key (24 chars)
[+] Generated .secrets/root_jwt_secret (64 hex chars)
Root account email (Gmail or your personal address) : root@example.com
[+] Root credentials generated in memory (printed once at end of install)
[+] Wrote manager-api auth bootstrap SQL (Accounts root row + RefreshTokens table)
[+] Hydration done - 47 files in runtime/config/
[+] INSTALLATION done. Next step:

[!] Root account password generated this run - save it now, it will NOT be shown again :
    email    : root@example.com
    password : T12G9qLdqW7OULcaYzJFTkUa
```

`install.sh` is **idempotent** : you can re-run it after editing `.env` to
re-hydrate the templates. The root account bootstrap is skipped on re-runs if
MariaDB is already initialized (existing `Accounts` row preserved).

## 3. Bring up the stack

The wrapper script handles compose profiles and the common lifecycle :

```bash
./service.sh up                 # core services
./service.sh enable clamav      # opt-in : antivirus
./service.sh enable opendmarc   # opt-in : DMARC milter
./service.sh enable phpmyadmin  # opt-in : DB explorer on :8082
./service.sh up                 # apply enabled profiles
```

The persistent profile selection lives in `.profiles` (gitignored, one profile
per line). Every `./service.sh` call applies the enabled profiles automatically.

Verify everything is healthy :

```bash
./service.sh ps                                                 # all containers up
curl -sSI http://127.0.0.1:4003/api/v1/health                   # 200 OK
curl http://127.0.0.1:4003/api/doc                              # Swagger UI HTML
```

## 4. Reverse proxy (host nginx)

manager-api, manager-ui, roundcube and rspamd-web bind on `127.0.0.1`. Front
them with a TLS-terminating reverse proxy on the host. Minimal nginx vhost :

```nginx
server {
  listen 443 ssl http2;
  server_name mail.example.com;
  ssl_certificate     /etc/letsencrypt/live/mail.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/mail.example.com/privkey.pem;

  location /api/ {
    proxy_pass http://127.0.0.1:4003;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
  location /webmail/ {
    proxy_pass http://127.0.0.1:4080/;
    proxy_set_header Host $host;
  }
}
```

`phpmyadmin` is the only web service exposed directly on `0.0.0.0:8082`. Disable
the profile when you're not actively investigating the DB.

## 5. First login

```bash
curl -s -X POST http://127.0.0.1:4003/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"root@example.com","password":"T12G9qLdqW7OULcaYzJFTkUa"}'
```

Returns `access_token`, `refresh_token`, `principal`. The access token is
short-lived (15 min by default), the refresh token is persisted in the
`RefreshTokens` table and can be revoked per session (`/auth/logout`) or all at
once (`/auth/logout-all`).

You can drive everything from Swagger at `http://127.0.0.1:4003/api/doc` -
paste the `access_token` once via the "Authorize" button and it persists across
page reloads.

## 6. Add your first domain

See [DOMAIN_DNS.md](DOMAIN_DNS.md) - covers MX, SPF, DKIM, DMARC and reverse DNS.

## Troubleshooting

- **`install.sh` exits silently** : it shouldn't anymore (ERR trap added), but if
  it does, run `bash -x install.sh` to trace.
- **manager-api logs `Required secret missing at /run/secrets/root_jwt_secret`** :
  the `.secrets/root_jwt_secret` file is missing on the host. Re-run `install.sh`
  to regenerate it, then `./service.sh restart manager-api`.
- **Login fails with `Invalid credentials`** : the root row was bootstrapped on a
  previous MariaDB datadir that no longer exists. Wipe `volumes/mysql/` and
  re-run `install.sh` (you'll get a new root password).
- **Mail goes to spam on Gmail / Outlook** : check PTR matches `DOMAIN_FQDN`,
  DKIM record published, DMARC published, sending IP not on a blocklist (`https://mxtoolbox.com/blacklists.aspx`).
