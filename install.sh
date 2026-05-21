#!/bin/bash
#
# v2.0.0 - install.sh
# Unique entry-point :
#  - validate .env
#  - generate persistent secrets (.secrets/)
#  - hydrate templates/ into runtime/config/ (sed substitutions)
#  - prepare volumes/
#  - optionally sync Letsencrypt certs
#
# Re-run idempotently when .env changes - placeholders are re-substituted
# from templates/ each time so runtime/config/ always matches .env.
#

set -euo pipefail

V2_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$V2_DIR"

ENV_FILE="$V2_DIR/.env"
SECRETS_DIR="$V2_DIR/.secrets"
TEMPLATES_DIR="$V2_DIR/templates"
RUNTIME_DIR="$V2_DIR/runtime/config"

C_RED=$'\e[31m'; C_GREEN=$'\e[32m'; C_YELLOW=$'\e[33m'; C_BLUE=$'\e[36m'; C_RESET=$'\e[0m'
log()  { echo "${C_BLUE}[*]${C_RESET} $*"; }
ok()   { echo "${C_GREEN}[+]${C_RESET} $*"; }
warn() { echo "${C_YELLOW}[!]${C_RESET} $*"; }
fail() { echo "${C_RED}[x]${C_RESET} $*" >&2; exit 1; }

# Loud failures - set -e exits silently otherwise, masking SIGPIPE / unset-var bugs
trap 'rc=$?; echo "${C_RED}[x]${C_RESET} install.sh aborted at line $LINENO (exit $rc, last cmd: $BASH_COMMAND)" >&2' ERR

#
# 1. .env validation
#
[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE - copy .env.sample and edit"
set -a; . "$ENV_FILE"; set +a

REQUIRED_VARS=(DOMAIN_FQDN ADRESSIP ADMIN_PASSWORD DKIM_MULTIPLE_SIGNATURES DKIM_MUST_BE_SIGNED \
  DMARC_SELECT DMARC_ENABLE DMARC_ORG_NAME DMARC_REJECT_FAILURES \
  ANTIVIRUS DISABLE_POSTCREEN_DEEP_PROTOCOL_TESTS \
  NOTIFY_SPAM_REJECT FAIL2BAN_MAXRETRY FAIL2BAN_FINDTIME FAIL2BAN_BANTIME \
  POSTFIX_PRIVATE_LOGS DOCKER_VOLUMES)
for v in "${REQUIRED_VARS[@]}"; do
  [[ -n "${!v:-}" ]] || fail "Missing required env var: $v"
done

# ADMIN_PASSWORD strength (mirror of 1.x.x utils.sh _checkPassword)
if [[ ${#ADMIN_PASSWORD} -lt 12 ]] \
  || ! [[ "$ADMIN_PASSWORD" =~ [A-Z] ]] \
  || ! [[ "$ADMIN_PASSWORD" =~ [a-z] ]] \
  || ! [[ "$ADMIN_PASSWORD" =~ [0-9] ]]; then
  fail "ADMIN_PASSWORD must be 12+ chars with upper, lower and digit"
fi

ok ".env loaded - FQDN=$DOMAIN_FQDN IP=$ADRESSIP"

#
# 2. Secrets generation (persistent, regenerated only if missing)
#
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Bounded pipes only : `head -c N` on /dev/urandom races with `set -o pipefail`
# (tr never reaches EOF, head closes stdin, tr exits 141, pipefail aborts the script
# silently). openssl emits a finite byte count, tr finishes cleanly, bash slicing
# takes the prefix - no SIGPIPE possible.
if [[ ! -f "$SECRETS_DIR/system_password" ]]; then
  _raw="$(openssl rand -base64 64 | tr -d '/+=\n')"
  printf '%s' "${_raw:0:50}" > "$SECRETS_DIR/system_password"
  ok "Generated SYSTEM_PASSWORD (mariadb root, 50 chars)"
fi
SYSTEM_PASSWORD="$(cat "$SECRETS_DIR/system_password")"

if [[ ! -f "$SECRETS_DIR/roundcube_des_key" ]]; then
  _raw="$(openssl rand -base64 32 | tr -d '/+=\n')"
  printf '%s' "${_raw:0:24}" > "$SECRETS_DIR/roundcube_des_key"
  ok "Generated Roundcube DES key (24 chars)"
fi
ROUNDCUBE_DES_KEY="$(cat "$SECRETS_DIR/roundcube_des_key")"

# Auth0 (RS256 + JWKS) handles all JWT issuance / refresh / SSO Google.
# manager-api validates tokens via the public JWKS endpoint, no shared secret needed.
# AUTH0_DOMAIN / AUTH0_AUDIENCE / AUTH0_ISSUER must be set manually in .env (Auth0 dashboard).
_warn_auth0_missing() {
  local key="$1"
  if ! grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    warn "$key not set in .env - manager-api will refuse to boot until you fill it from your Auth0 tenant"
  fi
}
_warn_auth0_missing "AUTH0_DOMAIN"
_warn_auth0_missing "AUTH0_AUDIENCE"
_warn_auth0_missing "AUTH0_ISSUER"

# manager-api JWT signing secret - independent of the root prompt, generated on every
# install if missing so the API container always has a /run/secrets/root_jwt_secret to mount.
if [[ ! -f "$SECRETS_DIR/root_jwt_secret" ]]; then
  openssl rand -hex 32 > "$SECRETS_DIR/root_jwt_secret"
  ok "Generated .secrets/root_jwt_secret (64 hex chars)"
fi
chmod 600 "$SECRETS_DIR/root_jwt_secret"

# Root account for manager-api : generated ONCE on first install, INSERTed into
# mailserver.Accounts via bootstrap SQL run on fresh MariaDB datadir. Credentials
# are printed to TTY exactly once at end of install and NEVER persisted to disk -
# they live in the DB only, queried back by manager-api for login.
ROOT_PWD_PRINT=""
ROOT_EMAIL_VAL=""
MARIADB_INITIALIZED=false
[[ -d "$DOCKER_VOLUMES/mysql/mysql" ]] && MARIADB_INITIALIZED=true

if [[ "$MARIADB_INITIALIZED" == "true" ]]; then
  log "MariaDB already initialized - skipping root bootstrap (existing Accounts row preserved)"
else
  [[ -t 0 ]] || fail "No TTY to prompt for root email - run install.sh interactively on first install"
  read -r -p "Root account email (Gmail or your personal address) : " ROOT_EMAIL_INPUT
  ROOT_EMAIL_INPUT="${ROOT_EMAIL_INPUT// /}"
  [[ -z "$ROOT_EMAIL_INPUT" ]] && fail "Root email cannot be empty"
  ROOT_EMAIL_VAL="$ROOT_EMAIL_INPUT"
  _raw="$(openssl rand -base64 32 | tr -d '/+=\n')"; ROOT_PWD_PRINT="${_raw:0:24}"
  ok "Root credentials generated in memory (printed once at end of install)"
  # SHA512-CRYPT hash with a fresh salt - identical scheme to Dovecot mailbox passwords
  # so the same verification path (openssl passwd -6 -salt ...) works everywhere.
  _raw="$(openssl rand -base64 24 | tr -d '/+=\n')"; ROOT_SALT="${_raw:0:16}"
  ROOT_HASHED="$(openssl passwd -6 -salt "$ROOT_SALT" "$ROOT_PWD_PRINT")"
  ROOT_EMAIL_ESC="${ROOT_EMAIL_VAL//\'/\'\'}"
  ROOT_HASHED_ESC="${ROOT_HASHED//\'/\'\'}"
fi

# Rspamd controller password is written cleartext in worker-controller.inc
# (rspamadm pw hash needs rspamd binary - we let the container do its own hashing at boot if needed).
# runtime/ is gitignored so the cleartext doesn't leak to git.

chmod 600 "$SECRETS_DIR"/*

#
# 3. Boolean -> string mapping (mirrors 1.x.x setup.d/* logic)
#
if [[ "${DISABLE_POSTCREEN_DEEP_PROTOCOL_TESTS,,}" == "true" ]]; then
  POSTSCREEN_DEEP="no"
else
  POSTSCREEN_DEEP="yes"
fi

FAIL2BAN_MAXRETRY_EFF="${FAIL2BAN_MAXRETRY:-30}"
FAIL2BAN_FINDTIME_EFF="${FAIL2BAN_FINDTIME:-90}"
FAIL2BAN_BANTIME_EFF="${FAIL2BAN_BANTIME:-3600}"
[[ "$FAIL2BAN_MAXRETRY_EFF" -gt 0 ]] || FAIL2BAN_MAXRETRY_EFF=30
[[ "$FAIL2BAN_FINDTIME_EFF" -gt 0 ]] || FAIL2BAN_FINDTIME_EFF=90
[[ "$FAIL2BAN_BANTIME_EFF" -gt 0 ]] || FAIL2BAN_BANTIME_EFF=3600

#
# 4. Hydration : templates/ -> runtime/config/ with sed substitutions
#
log "Hydrating templates into runtime/config/..."
rm -rf "$RUNTIME_DIR"
mkdir -p "$RUNTIME_DIR"
cp -R "$TEMPLATES_DIR"/. "$RUNTIME_DIR"/

# Order the mariadb init scripts - they run in alphabetical order in /docker-entrypoint-initdb.d/
# config.sql MUST run first (creates the mailserver DB + mailuser GRANTs).
if [[ -d "$RUNTIME_DIR/mariadb/init" ]]; then
  [[ -f "$RUNTIME_DIR/mariadb/init/config.sql" ]] \
    && mv "$RUNTIME_DIR/mariadb/init/config.sql" "$RUNTIME_DIR/mariadb/init/00_config.sql"
  [[ -f "$RUNTIME_DIR/mariadb/init/build.sql" ]] \
    && mv "$RUNTIME_DIR/mariadb/init/build.sql" "$RUNTIME_DIR/mariadb/init/10_mailserver_schema.sql"
  [[ -f "$RUNTIME_DIR/mariadb/init/opendmarc.sql" ]] \
    && mv "$RUNTIME_DIR/mariadb/init/opendmarc.sql" "$RUNTIME_DIR/mariadb/init/20_opendmarc_schema.sql"
  [[ -f "$RUNTIME_DIR/mariadb/init/roundcube.sql" ]] \
    && mv "$RUNTIME_DIR/mariadb/init/roundcube.sql" "$RUNTIME_DIR/mariadb/init/30_roundcube_schema.sql"

  # Multi-container adaptation : 1.x.x created mailuser@localhost (everything was one container).
  # In v2 manager-api / dovecot / postfix / roundcube connect across the docker network from
  # different IPs. Add an additive GRANT for mailuser@'%' so they can authenticate without
  # touching the 1.x.x config.sql semantics for localhost connections.
  cat > "$RUNTIME_DIR/mariadb/init/05_mailuser_remote_grant.sql" <<EOF
CREATE USER IF NOT EXISTS 'mailuser'@'%' IDENTIFIED BY '$ADMIN_PASSWORD';
GRANT ALL PRIVILEGES ON mailserver.* TO 'mailuser'@'%';
GRANT ALL PRIVILEGES ON opendmarc.* TO 'mailuser'@'%';
GRANT ALL PRIVILEGES ON roundcube.* TO 'mailuser'@'%';
FLUSH PRIVILEGES;
EOF
fi

# Use a safe delimiter (|) for sed since DOMAIN_FQDN and paths may contain /
_sed_in_place() {
  local needle="$1" value="$2" file="$3"
  sed -i "s|${needle}|${value}|g" "$file"
}

# Walk all files under runtime/config/ and substitute placeholders
while IFS= read -r -d '' f; do
  _sed_in_place "____mailRootPass" "$SYSTEM_PASSWORD" "$f"
  _sed_in_place "____mailUserPass" "$ADMIN_PASSWORD" "$f"
  _sed_in_place "____domainFQDN" "$DOMAIN_FQDN" "$f"
  _sed_in_place "____postscreenDeepProtocolTests" "$POSTSCREEN_DEEP" "$f"
  _sed_in_place "____fail2BanMaxRetry" "$FAIL2BAN_MAXRETRY_EFF" "$f"
  _sed_in_place "____fail2BanFindtime" "$FAIL2BAN_FINDTIME_EFF" "$f"
  _sed_in_place "____fail2BanBantime" "$FAIL2BAN_BANTIME_EFF" "$f"
  _sed_in_place "____notifySpamRejectTo" "${NOTIFY_SPAM_REJECT_TO:-}" "$f"
  _sed_in_place "____dkimMultipleSignatures" "$DKIM_MULTIPLE_SIGNATURES" "$f"
  _sed_in_place "____dkimMustBeSigned" "$DKIM_MUST_BE_SIGNED" "$f"
  _sed_in_place "____dmarcDomain" "${DMARC_DOMAIN:-}" "$f"
  _sed_in_place "____dmarcEnable" "$DMARC_ENABLE" "$f"
  _sed_in_place "____dmarcOrgName" "$DMARC_ORG_NAME" "$f"
  _sed_in_place "____dmarcReports" "${DMARC_REPORTS:-}" "$f"
  _sed_in_place "____opendmarcRejectFailures" "$DMARC_REJECT_FAILURES" "$f"
  _sed_in_place "____opendmarcVarFolder" "/var/opendmarc" "$f"
  _sed_in_place "____ROUNDCUBE_DES_KEY" "$ROUNDCUBE_DES_KEY" "$f"
done < <(find "$RUNTIME_DIR" -type f -print0)

# Rspamd controller password (cleartext - mirrors 1.x.x 24-rspamd.sh logic at boot)
mkdir -p "$RUNTIME_DIR/rspamd/local.d"
printf 'password = "%s"\n' "$ADMIN_PASSWORD" > "$RUNTIME_DIR/rspamd/local.d/worker-controller.inc"

# Postfix log routing : strip maillog_file line if logs go to syslog
if [[ "${POSTFIX_PRIVATE_LOGS,,}" != "true" ]]; then
  sed -i "/maillog_file=/d" "$RUNTIME_DIR/postfix/main.cf"
fi

# Postfix milters : declarative chain (no more sequential sed appends)
MILTERS="inet:opendkim:12301, inet:rspamd:11332"
if [[ "${DMARC_ENABLE,,}" == "true" && "$DMARC_SELECT" == "OpenDMARC" ]]; then
  MILTERS="$MILTERS, inet:opendmarc:8893"
fi
sed -i "s|^smtpd_milters =.*|smtpd_milters = $MILTERS|" "$RUNTIME_DIR/postfix/main.cf" || true

# Multi-container adaptation : postfix/dovecot/roundcube MySQL configs all referenced
# `localhost`/`127.0.0.1` in the 1.x.x monolith. In v2 the DB is in a separate container,
# so the host becomes the docker service name `mariadb`. The user/password stay identical
# to 1.x.x (root + SYSTEM_PASSWORD) - this preserves the compat lock on auth.
log "Patching MySQL host references for multi-container connectivity..."
for f in "$RUNTIME_DIR"/postfix/mysql-virtual-*.cf "$RUNTIME_DIR"/dovecot/db-sql/_mysql-connect.conf; do
  [[ -f "$f" ]] || continue
  sed -i 's|^hosts = 127\.0\.0\.1|hosts = mariadb|' "$f"
  sed -i 's|host=localhost|host=mariadb|g' "$f"
  sed -i 's|host=127\.0\.0\.1|host=mariadb|g' "$f"
done

# Alpine adaptation : opendkim.conf points TrustAnchorFile at a Debian-only path.
# Alpine doesn't ship the dnssec-anchors at that location ; DNSSEC validation is non-essential
# for DKIM signing so we comment the directive out.
if [[ -f "$RUNTIME_DIR/opendkim/opendkim.conf" ]]; then
  sed -i 's|^TrustAnchorFile|#TrustAnchorFile|' "$RUNTIME_DIR/opendkim/opendkim.conf"
fi

# fail2ban : the 1.x.x jail.local references custom filters (dovecot-auth_failed, postfix-ddos, ...)
# whose definitions use Debian-specific interpolation keys absent from the Alpine fail2ban image.
# We regenerate a minimal jail.local using the stock filters shipped with crazymax/fail2ban.
cat > "$RUNTIME_DIR/fail2ban/jail.local" <<EOF
[DEFAULT]
maxretry = ${FAIL2BAN_MAXRETRY_EFF}
findtime = ${FAIL2BAN_FINDTIME_EFF}
bantime  = ${FAIL2BAN_BANTIME_EFF}
ignoreip = 127.0.0.1/8 ::1 172.16.0.0/12 192.168.0.0/16

# fail2ban runs in network_mode: host - default banaction (iptables-multiport) targets the host.
banaction = iptables-multiport

[dovecot]
enabled  = true
filter   = dovecot
logpath  = /var/log/dovecot.log
port     = imap,imaps,pop3,pop3s,submission,submissions

[postfix]
enabled  = true
filter   = postfix
logpath  = /var/log/mail.log
port     = smtp,smtps,submission

[postfix-sasl]
enabled  = true
filter   = postfix-sasl
logpath  = /var/log/mail.log
port     = smtp,smtps,submission
EOF

# Sanity : any remaining placeholder is a bug
REMAINING="$(grep -rohE '____[a-zA-Z]+' "$RUNTIME_DIR" 2>/dev/null | sort -u || true)"
if [[ -n "$REMAINING" ]]; then
  warn "Unhydrated placeholders left in runtime/config/:"
  echo "$REMAINING" | sed 's|^|    |'
fi

# manager-api login bootstrap : extends the existing 1.x.x `Accounts` table with the
# columns needed to authenticate (password_hash, role, is_active, ...) and creates the
# RefreshTokens table where issued refresh JWTs are persisted (one row per session,
# revocable). Runs ONCE on fresh MariaDB datadir ; skipped on re-installs so we don't
# overwrite hashes that no longer match what we'd print.
if [[ "$MARIADB_INITIALIZED" == "false" ]]; then
  cat > "$RUNTIME_DIR/mariadb/init/99_manager_api_auth.sql" <<EOF
USE mailserver;

ALTER TABLE \`Accounts\`
  ADD COLUMN IF NOT EXISTS \`password_hash\` varchar(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS \`role\` enum('root','admin','owner','user') NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS \`created_at\` datetime DEFAULT current_timestamp(),
  ADD COLUMN IF NOT EXISTS \`last_login_at\` datetime DEFAULT NULL,
  ADD INDEX IF NOT EXISTS \`idx_accounts_role\` (\`role\`);

CREATE TABLE IF NOT EXISTS \`RefreshTokens\` (
  \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
  \`jti\` char(36) NOT NULL,
  \`account_id\` int(11) NOT NULL,
  \`expires_at\` datetime NOT NULL,
  \`revoked_at\` datetime DEFAULT NULL,
  \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
  \`last_used_at\` datetime DEFAULT NULL,
  \`user_agent\` varchar(255) DEFAULT NULL,
  \`ip\` varchar(45) DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_RefreshTokens_jti\` (\`jti\`),
  KEY \`idx_RefreshTokens_account_id\` (\`account_id\`),
  KEY \`idx_RefreshTokens_expires_at\` (\`expires_at\`),
  FOREIGN KEY (\`account_id\`) REFERENCES \`Accounts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8 COLLATE = utf8_general_ci;

INSERT INTO \`Accounts\` (\`username\`, \`password_hash\`, \`role\`, \`is_active\`)
  VALUES ('$ROOT_EMAIL_ESC', '$ROOT_HASHED_ESC', 'root', 1)
  ON DUPLICATE KEY UPDATE
    \`password_hash\` = VALUES(\`password_hash\`),
    \`role\` = 'root',
    \`is_active\` = 1;
EOF
  ok "Wrote manager-api auth bootstrap SQL (Accounts root row + RefreshTokens table)"
fi

ok "Hydration done - $(find "$RUNTIME_DIR" -type f | wc -l) files in runtime/config/"

#
# 5. Volumes preparation
#
log "Preparing volumes under $DOCKER_VOLUMES ..."
mkdir -p "$DOCKER_VOLUMES"/{mail,mysql,redis,rspamd,opendkim,opendmarc,clamav,fail2ban,ssl,postfix-spool,log,roundcube}

# OpenDKIM expects KeyTable / SigningTable / TrustedHosts files even when no DKIM key is registered.
# Touch empty placeholders so the daemon starts ; dkim-create.sh appends to them later.
[[ -f "$DOCKER_VOLUMES/opendkim/key.table" ]] || sudo touch "$DOCKER_VOLUMES/opendkim/key.table"
[[ -f "$DOCKER_VOLUMES/opendkim/signing.table" ]] || sudo touch "$DOCKER_VOLUMES/opendkim/signing.table"
if [[ ! -f "$DOCKER_VOLUMES/opendkim/trusted.hosts" ]]; then
  sudo tee "$DOCKER_VOLUMES/opendkim/trusted.hosts" >/dev/null <<EOF
127.0.0.1
::1
localhost
$DOMAIN_FQDN
EOF
fi
sudo mkdir -p "$DOCKER_VOLUMES/opendkim/keys"

# Fail2ban watches log files - touch them so the jails don't refuse to start on a fresh volume.
sudo mkdir -p "$DOCKER_VOLUMES/log"
for f in mail.log dovecot.log auth.log; do
  [[ -f "$DOCKER_VOLUMES/log/$f" ]] || sudo touch "$DOCKER_VOLUMES/log/$f"
done

#
# 6. Letsencrypt sync (optional, non-fatal)
#
LE_LIVE="/etc/letsencrypt/live/$DOMAIN_FQDN"
# Use sudo for the test since /etc/letsencrypt/live is typically 700 root
if sudo test -d "$LE_LIVE"; then
  log "Syncing Letsencrypt certs from $LE_LIVE ..."
  if sudo cp -L "$LE_LIVE/fullchain.pem" "$DOCKER_VOLUMES/ssl/" \
    && sudo cp -L "$LE_LIVE/privkey.pem" "$DOCKER_VOLUMES/ssl/" \
    && sudo chmod 644 "$DOCKER_VOLUMES/ssl/"*.pem; then
    ok "SSL certs copied"
  else
    warn "Could not copy Letsencrypt certs"
  fi
else
  warn "No Letsencrypt certs found at $LE_LIVE - default self-signed will be used"
fi

echo
if [[ -n "${ROOT_PWD_PRINT:-}" ]]; then
  warn "Root account password generated this run - save it now, it will NOT be shown again :"
  echo "    email    : $ROOT_EMAIL_VAL"
  echo "    password : $ROOT_PWD_PRINT"
  echo
fi
ok "INSTALLATION done. Next step:"
echo "    docker compose up -d"
