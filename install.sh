#!/usr/bin/env bash
# Simply Mail Server v2 one-shot installer.
#
# A non-technical user types a hostname, hits enter for everything else, walks
# away with: full stack running, schema created by TypeORM, admin account
# seeded, primary domain provisioned (postmaster@<domain> reserved inactive,
# real mailboxes are created later via the manager-ui), DKIM key generated and
# the DNS record printed ready to paste. Passwords are auto-generated.
#
# Idempotent: re-runs only fill what is missing.
set -euo pipefail
cd "$(dirname "$0")"

SAMPLE=.env.sample
TARGET=.env

c()    { printf '\033[1;34m[install]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
q()    { printf '\033[1;36m[?]\033[0m %s ' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[fatal]\033[0m %s\n' "$*"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  die "This script must be run with sudo or as root"
fi

[ -f "$SAMPLE" ] || die ".env.sample missing"

# `_INSTALL_STAGE` records the last successfully-completed step so a Ctrl-C
# mid-install can be resumed with a plain `./install.sh` re-run. The
# underscore prefix marks the line as installer scaffolding: every key
# matching `^_[A-Z_]+=` is wiped from .env once the install finishes, so
# the live runtime config never carries internal state. Stages are ordered
# and a re-run skips every step whose name appears at or before the
# recorded marker.
STAGE_KEY="_INSTALL_STAGE"
STAGES=(start config secrets up schema admin domain dkim)

env_get() { grep -E "^${1}=" "$TARGET" 2>/dev/null | head -1 | cut -d= -f2-; }
env_set() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$TARGET"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$TARGET"
  else
    echo "${key}=${value}" >> "$TARGET"
  fi
}

stage_index() {
  local s="$1" i=0
  for x in "${STAGES[@]}"; do
    [ "$x" = "$s" ] && echo "$i" && return
    i=$((i+1))
  done
  echo -1
}
stage_done() {
  # Returns 0 (skip work) if the requested checkpoint is at or before the
  # last completed stage recorded in .env.
  local want="$1" have wi hi
  have=$(env_get "$STAGE_KEY")
  [ -z "$have" ] && return 1
  wi=$(stage_index "$want"); hi=$(stage_index "$have")
  [ "$hi" -lt 0 ] || [ "$wi" -lt 0 ] && return 1
  [ "$hi" -ge "$wi" ]
}
stage_set()   { env_set "$STAGE_KEY" "$1"; }
stage_purge() { sed -i -E '/^_[A-Z_]+=/d' "$TARGET"; }

# -----------------------------------------------------------------------------
# Pre-flight: decide whether this is a fresh install, a resume, or a refusal.
# -----------------------------------------------------------------------------
if [ -f "$TARGET" ]; then
  RESUME_STAGE=$(env_get "$STAGE_KEY")
  if [ -z "$RESUME_STAGE" ]; then
    die ".env exists and carries no _INSTALL_STAGE marker, which means a
         previous install finished successfully. install.sh refuses to
         clobber a live .env. To start over:
           sudo rm -rf volumes/ INSTALL_INFO.txt && rm .env
         To tweak values without reinstalling: edit .env directly."
  fi
  c "resuming install from stage: $RESUME_STAGE"
elif [ -d volumes ]; then
  die "./volumes/ exists but .env does not -- inconsistent state.
       stateful services would skip their init step and keep whatever
       credentials lived in volumes/ before. To start over:
         sudo rm -rf volumes/ INSTALL_INFO.txt"
else
  c "creating $TARGET from $SAMPLE"
  cp "$SAMPLE" "$TARGET"
  stage_set start
fi
# After this point, .env exists and $STAGE_KEY is set. Any later die() exit
# leaves the marker in place, so the next ./install.sh resumes cleanly.

needs_input() {
  local v="$1"
  [[ -z "$v" || "$v" =~ example\.com|203\.0\.113\.10|change_me ]]
}

ask() {
  local key="$1" label="$2" default="$3"
  local current
  current=$(env_get "$key")
  if needs_input "$current"; then
    if [ -n "$default" ]; then
      q "$label [$default]:"
    else
      q "$label:"
    fi
    local answer
    read -e -r answer
    env_set "$key" "${answer:-$default}"
  fi
}

rand_b64()   { openssl rand -base64 48 | tr -d '\n/+=' | head -c 32; }
rand_alnum() { openssl rand -hex 16; }

# Normalize Roundcube locale input. Accepts short codes (fr, FR, Fr) and
# expands them to the canonical xx_YY form; passes through a full xx_YY
# if the user typed it. Echoes empty string on unknown input.
normalize_lang() {
  case "${1,,}" in
    en|en_us)     echo "en_US"  ;;
    fr|fr_fr)     echo "fr_FR"  ;;
    de|de_de)     echo "de_DE"  ;;
    es|es_es)     echo "es_ES"  ;;
    it|it_it)     echo "it_IT"  ;;
    pt|pt_pt)     echo "pt_PT"  ;;
    pt_br)        echo "pt_BR"  ;;
    nl|nl_nl)     echo "nl_NL"  ;;
    ru|ru_ru)     echo "ru_RU"  ;;
    pl|pl_pl)     echo "pl_PL"  ;;
    *)
      if [[ "$1" =~ ^[a-zA-Z]{2}_[a-zA-Z]{2}$ ]]; then
        local lo="${1%_*}" hi="${1#*_}"
        echo "${lo,,}_${hi^^}"
      fi
      ;;
  esac
}

# Prompt for a Roundcube language. Accepts short aliases (fr, FR, en, ...)
# and full locales (fr_FR, pt_BR, ...). Echoes the canonical xx_YY value.
prompt_lang() {
  local label="$1" default="$2" ans norm
  while true; do
    printf '\033[1;36m[?]\033[0m %s (en, fr, de, es, it, pt, nl, ru, pl, ... or full like pt_BR) [%s]: ' \
      "$label" "$default" >&2
    read -e -r ans
    ans="${ans:-$default}"
    norm=$(normalize_lang "$ans")
    if [ -n "$norm" ]; then
      printf '%s' "$norm"
      return 0
    fi
    printf '\033[1;33m[warn]\033[0m unknown language %q, try a short code (fr, en, de, ...) or a full xx_YY locale\n' "$ans" >&2
  done
}

# Read a value in a validation loop: re-prompts until the answer matches the
# regex. Echoes the validated value (caller captures with $(...)).
# Warnings and prompts go to stderr so they do not pollute the captured value.
prompt_re() {
  local label="$1" default="$2" pattern="$3" hint="$4" ans
  while true; do
    if [ -n "$default" ]; then
      printf '\033[1;36m[?]\033[0m %s [%s]: ' "$label" "$default" >&2
    else
      printf '\033[1;36m[?]\033[0m %s: ' "$label" >&2
    fi
    read -e -r ans
    ans="${ans:-$default}"
    if [[ "$ans" =~ $pattern ]]; then
      printf '%s' "$ans"
      return 0
    fi
    printf '\033[1;33m[warn]\033[0m invalid input, expected: %s\n' "$hint" >&2
  done
}

set_secret_if_placeholder() {
  local key="$1" value="$2"
  if grep -qE "^${key}=change_me" "$TARGET"; then
    env_set "$key" "$value"
  fi
}

# ---------------------------------------------------------------------------
# 1. Interactive configuration
# ---------------------------------------------------------------------------
if ! stage_done config; then
  echo
  c "configuration"

  # Prompt for the FQDN in a loop: a Let's Encrypt cert for it must already
  # exist on the host. Re-prompt until the user enters a name whose cert is
  # present (or Ctrl-C). Only persist to .env once the check passes.
  LE_PATH=$(env_get TLS_LETSENCRYPT_PATH)
  FQDN_DEFAULT="mail.example.com"
  while true; do
    q "Mail server FQDN (PTR + cert CN) [$FQDN_DEFAULT]:"
    read -e -r ANSWER
    HOSTNAME="${ANSWER:-$FQDN_DEFAULT}"
    CERT_DIR="${LE_PATH}/live/${HOSTNAME}"
    if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
      env_set MAIL_HOSTNAME "$HOSTNAME"
      env_set TLS_CERT_NAME "$HOSTNAME"
      ok "TLS certificate found at ${CERT_DIR}"
      break
    fi
    warn "no Let's Encrypt certificate at ${CERT_DIR}/{fullchain,privkey}.pem"
    warn "obtain one with: sudo certbot certonly --standalone -d ${HOSTNAME}"
    warn "then re-enter the FQDN below (or Ctrl-C to quit)"
    FQDN_DEFAULT="$HOSTNAME"
  done

  DETECTED_IP=$(curl -s --max-time 4 https://api.ipify.org 2>/dev/null \
              || curl -s --max-time 4 https://ifconfig.me 2>/dev/null \
              || true)
  PUBLIC_IP=$(prompt_re "Public IPv4 of this host" "$DETECTED_IP" \
    '^([0-9]{1,3}\.){3}[0-9]{1,3}$' "IPv4 like 203.0.113.10")
  env_set MAIL_PUBLIC_IP "$PUBLIC_IP"

  DEFAULT_DOMAIN="${HOSTNAME#mail.}"
  PRIMARY_DOMAIN=$(prompt_re "Primary mail domain" "$DEFAULT_DOMAIN" \
    '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' \
    "domain name like example.com")
  # Persist as a temp key so a resume can re-read it without re-prompting.
  # `_*` keys are wiped from .env at the end of a successful install.
  env_set _PRIMARY_DOMAIN "$PRIMARY_DOMAIN"

  RC_LANG=$(prompt_lang "Roundcube default language" "en_US")
  env_set ROUNDCUBE_LANGUAGE "$RC_LANG"

  ATTACH_MB=$(prompt_re "Maximum attachment size in MB (postfix + Roundcube)" "25" \
    '^[1-9][0-9]{0,3}$' \
    "integer between 1 and 9999 MB (Gmail caps at 25)")
  env_set ATTACHMENT_MAX_SIZE_MB "$ATTACH_MB"

  stage_set config
fi

# Rehydrate shell vars from .env: on a fresh run these were set inside the
# config block above, but on a resume the block was skipped, so the vars
# need to come back from .env.
HOSTNAME=$(env_get MAIL_HOSTNAME)
PUBLIC_IP=$(env_get MAIL_PUBLIC_IP)
PRIMARY_DOMAIN=$(env_get _PRIMARY_DOMAIN)

# ---------------------------------------------------------------------------
# 2. Secrets (auto-generated, never asked)
# ---------------------------------------------------------------------------
if ! stage_done secrets; then
  c "generating secrets where placeholders remain"
  set_secret_if_placeholder DB_PASSWORD                "$(rand_alnum)"
  set_secret_if_placeholder DB_ROOT_PASSWORD           "$(rand_alnum)"
  set_secret_if_placeholder RSPAMD_PASSWORD            "$(rand_alnum)"
  set_secret_if_placeholder MANAGER_JWT_ACCESS_SECRET  "$(rand_b64)"
  set_secret_if_placeholder MANAGER_JWT_REFRESH_SECRET "$(rand_b64)"
  set_secret_if_placeholder MANAGER_ADMIN_PASSWORD     "$(rand_alnum)"
  stage_set secrets
fi

DB_NAME=$(env_get DB_NAME)
DB_ROOT=$(env_get DB_ROOT_PASSWORD)
ADMIN_USER=$(env_get MANAGER_ADMIN_USERNAME)
ADMIN_PASS=$(env_get MANAGER_ADMIN_PASSWORD)
MANAGEUI_PORT=$(env_get BINDING_PORT_MANAGEUI)
ROUNDCUBE_PORT=$(env_get BINDING_PORT_ROUNDCUBE)
PHPMYADMIN_PORT=$(env_get BINDING_PORT_PHPMYADMIN)
RSPAMDUI_PORT=$(env_get BINDING_PORT_RSPAMD_UI)

# ---------------------------------------------------------------------------
# 3. Full stack up
# ---------------------------------------------------------------------------
if ! stage_done up; then
  c "building images and bringing the full stack up..."
  docker compose up -d --build
  stage_set up
fi

# ---------------------------------------------------------------------------
# 4. Wait for TypeORM to create the schema
# ---------------------------------------------------------------------------
if ! stage_done schema; then
  c "waiting for TypeORM to create the schema (max 180s)..."
  T=180
  until docker compose exec -T mariadb mariadb -uroot -p"$DB_ROOT" "$DB_NAME" \
          -e "SHOW TABLES LIKE 'accounts'" 2>/dev/null | grep -q accounts; do
    sleep 1
    T=$((T-1))
    [ $T -le 0 ] && die "manager-api did not finish creating the schema in time"
  done
  ok "schema ready"
  stage_set schema
fi

# ---------------------------------------------------------------------------
# 5. Seed admin
# ---------------------------------------------------------------------------
if ! stage_done admin; then
  c "hashing admin password and upserting accounts row..."
  ADMIN_HASH=$(docker compose exec -T -e P="$ADMIN_PASS" manager-api \
    node -e "console.log(require('bcrypt').hashSync(process.env.P, 12))" \
    | tr -d '\r')
  docker compose exec -T mariadb mariadb -uroot -p"$DB_ROOT" "$DB_NAME" <<SQL
INSERT INTO accounts (username, password, role, enabled, created_at, updated_at)
VALUES ('${ADMIN_USER}', '${ADMIN_HASH}', 'admin', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE password=VALUES(password), updated_at=NOW();
SQL
  ok "admin account ready"
  stage_set admin
fi

# ---------------------------------------------------------------------------
# 6. Seed primary domain and reserve postmaster
# ---------------------------------------------------------------------------
if ! stage_done domain; then
  c "provisioning primary domain ${PRIMARY_DOMAIN} (real mailboxes are created later via the manager-ui)..."
  DOMAIN_QUOTA=$((10 * 1024 * 1024 * 1024))
  # postmaster@<domain> is the envelope-from used by dovecot-lda for system
  # notifications (blocklist alerts in images/dovecot/conf/sieve/bin/hooks/
  # 40-notify.sh, etc.). Insert it as active=0 so no one can authenticate or
  # receive inbound mail on it; LDA delivery only uses it as a header string,
  # never as a destination.
  POSTMASTER_HASH=$(openssl passwd -6 -salt "$(openssl rand -hex 8)" "$(rand_alnum)")
  docker compose exec -T mariadb mariadb -uroot -p"$DB_ROOT" "$DB_NAME" <<SQL
INSERT IGNORE INTO virtual_domains (domain, quota, active)
VALUES ('${PRIMARY_DOMAIN}', ${DOMAIN_QUOTA}, 1);

INSERT INTO virtual_users (domain, email, password, maildir, quota, active)
VALUES ('${PRIMARY_DOMAIN}', 'postmaster@${PRIMARY_DOMAIN}', '${POSTMASTER_HASH}', '${PRIMARY_DOMAIN}/postmaster/', 0, 0)
ON DUPLICATE KEY UPDATE active=0;
SQL
  ok "domain provisioned (postmaster@${PRIMARY_DOMAIN} reserved inactive)"
  stage_set domain
fi

# ---------------------------------------------------------------------------
# 7. DKIM key
# ---------------------------------------------------------------------------
if ! stage_done dkim; then
  c "generating DKIM key for ${PRIMARY_DOMAIN} via the opendkim sidecar..."
  T=30
  until docker compose exec -T opendkim curl -fsS http://localhost:8080/healthz >/dev/null 2>&1; do
    sleep 1
    T=$((T-1))
    [ $T -le 0 ] && die "opendkim dkim-api sidecar did not become ready in time"
  done

  # POST to the sidecar AND parse the JSON inside the same opendkim container
  # using python3 (already installed there for dkim-api.py). The sidecar emits
  # compact JSON, but parsing via a real JSON library is the only way that
  # stays correct no matter how dkim-api.py decides to format its output later.
  # Output format: "<selector>|<txtRecord>" with a literal '|' as separator,
  # which never appears in either field.
  DKIM_PARSED=$(docker compose exec -T opendkim sh -c "curl -fsS -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:8080/keys/${PRIMARY_DOMAIN} | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[\"selector\"]+\"|\"+d[\"txtRecord\"])'") \
    || die "dkim-api request failed for ${PRIMARY_DOMAIN}"
  SELECTOR="${DKIM_PARSED%%|*}"
  DKIM_VALUE="${DKIM_PARSED#*|}"
  [ -n "$SELECTOR" ] && [ -n "$DKIM_VALUE" ] || die "dkim-api returned an unexpected payload: ${DKIM_PARSED}"
  ok "DKIM key generated (selector ${SELECTOR})"

  # Persist the DKIM material into the manager-api `dkim_keys` table so direct
  # DB queries (phpMyAdmin, ops scripts) see the row immediately, without
  # waiting for a manager-api self-heal on the next /api/v1/domains/:id/dkim
  # call. DkimService.list() also reads from this table; populating it here
  # means the primary domain's DKIM key is available API-side from second 1.
  DNS_NAME="${SELECTOR}._domainkey"
  PUBLIC_KEY=$(printf '%s' "$DKIM_VALUE" | sed -n 's/.*p=\([^;[:space:]]*\).*/\1/p')
  [ -n "$PUBLIC_KEY" ] || die "could not extract the base64 public key from the TXT record"
  docker compose exec -T mariadb mariadb -uroot -p"$DB_ROOT" "$DB_NAME" <<SQL
INSERT INTO dkim_keys (domain, selector, dns_name, public_key, txt_record)
VALUES ('${PRIMARY_DOMAIN}', '${SELECTOR}', '${DNS_NAME}', '${PUBLIC_KEY}', '${DKIM_VALUE}')
ON DUPLICATE KEY UPDATE
  dns_name = VALUES(dns_name),
  public_key = VALUES(public_key),
  txt_record = VALUES(txt_record);
SQL
  ok "DKIM material persisted in dkim_keys"

  # Cache the SELECTOR / TXT for the summary so a resumed run (skipping
  # this block) can still display the DNS record without re-querying.
  env_set _DKIM_SELECTOR  "$SELECTOR"
  env_set _DKIM_TXT_RECORD "$DKIM_VALUE"
  stage_set dkim
fi

# Rehydrate DKIM display vars from .env for the summary block below.
SELECTOR=$(env_get _DKIM_SELECTOR)
DKIM_VALUE=$(env_get _DKIM_TXT_RECORD)

# ---------------------------------------------------------------------------
# 8. Summary
# ---------------------------------------------------------------------------
PUBLIC_DISPLAY="${PUBLIC_IP:-<MAIL_PUBLIC_IP>}"
cat <<EOF | tee INSTALL_INFO.txt

==========================================================================
                       install complete
==========================================================================

URLs (binding IPs are set in .env, default 127.0.0.1 for UIs):
  manager UI   : http://${PUBLIC_DISPLAY}:${MANAGEUI_PORT}
  roundcube    : http://${PUBLIC_DISPLAY}:${ROUNDCUBE_PORT}
  phpmyadmin   : http://${PUBLIC_DISPLAY}:${PHPMYADMIN_PORT}
  rspamd UI    : http://${PUBLIC_DISPLAY}:${RSPAMDUI_PORT}

Manager UI credentials:
  login        : ${ADMIN_USER}
  password     : ${ADMIN_PASS}

Create real mailboxes from the manager-ui (login above, then Users -> +Add).
postmaster@${PRIMARY_DOMAIN} is reserved as the inactive system sender and
must stay inactive (it is only used as envelope-from on system notifications).

phpMyAdmin (root):
  user         : root
  password     : ${DB_ROOT}

DKIM DNS record to publish for ${PRIMARY_DOMAIN}:
  Name  : ${SELECTOR}._domainkey
  Type  : TXT
  Value : "${DKIM_VALUE}"

After publishing the DNS record (1-5 min propagation), verify with:
  docker exec mail-opendkim opendkim-testkey \\
    -d ${PRIMARY_DOMAIN} -s ${SELECTOR} \\
    -k /etc/opendkim/keys/${PRIMARY_DOMAIN}/${SELECTOR}.private -vvv

See DOMAIN_DNS.md for the full DNS record set (MX, SPF, DMARC).
==========================================================================
EOF

# Install reached the end: wipe every installer-owned scaffolding key
# (`_INSTALL_STAGE`, `_PRIMARY_DOMAIN`, `_DKIM_*`, anything matching
# `^_[A-Z_]+=`) so the live .env carries only runtime config. A re-run of
# install.sh against this .env will now die with the "completed install"
# branch of the preflight, as expected.
stage_purge
ok "install.sh complete; .env scrubbed of internal scaffolding"
