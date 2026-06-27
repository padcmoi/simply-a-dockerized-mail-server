#!/usr/bin/env bash
# First-run bootstrap. Generates .env with strong secrets, creates the initial
# admin row in Accounts, and reminds you of the DKIM key generation step.
# Idempotent.
set -euo pipefail
cd "$(dirname "$0")"

SAMPLE=.env.sample
TARGET=.env

c()   { printf '\033[1;34m[install]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[fatal]\033[0m %s\n' "$*"; exit 1; }

[ -f "$SAMPLE" ] || die ".env.sample missing"
[ -f "$TARGET" ] || { c "creating $TARGET from $SAMPLE"; cp "$SAMPLE" "$TARGET"; }

rand_b64()   { openssl rand -base64 48 | tr -d '\n/+=' | head -c 32; }
rand_alnum() { openssl rand -hex 16; }

substitute() {
  local key="$1" value="$2"
  if grep -Eq "^${key}=change_me" "$TARGET"; then
    c "setting ${key}"
    sed -i "s|^${key}=change_me.*|${key}=${value}|" "$TARGET"
  fi
}

substitute DB_PASSWORD                "$(rand_alnum)"
substitute DB_ROOT_PASSWORD           "$(rand_alnum)"
substitute RSPAMD_PASSWORD            "$(rand_alnum)"
substitute MANAGER_JWT_ACCESS_SECRET  "$(rand_b64)"
substitute MANAGER_JWT_REFRESH_SECRET "$(rand_b64)"
substitute MANAGER_ADMIN_PASSWORD     "$(rand_alnum)"

needs_input=0
for k in MAIL_HOSTNAME MAIL_PUBLIC_IP TLS_CERT_NAME; do
  v=$(grep -E "^${k}=" "$TARGET" | head -1 | cut -d= -f2-)
  if [[ "$v" =~ example\.com|203\.0\.113\.10 ]]; then
    warn "${k} still has sample value (${v}) - edit .env then re-run"
    needs_input=1
  fi
done

if [ "$needs_input" -eq 1 ]; then
  echo
  echo "edit $TARGET first, then run ./service.sh up"
  exit 0
fi

c "bringing mariadb up..."
docker compose up -d mariadb
docker compose exec -T mariadb sh -c 'until healthcheck.sh --connect --innodb_initialized 2>/dev/null; do sleep 1; done' || die "mariadb did not become healthy"

c "seeding initial Accounts row..."
ADMIN_USER=$(grep -E '^MANAGER_ADMIN_USERNAME=' "$TARGET" | cut -d= -f2-)
ADMIN_PASS=$(grep -E '^MANAGER_ADMIN_PASSWORD=' "$TARGET" | cut -d= -f2-)
DB_NAME=$(grep -E '^DB_NAME=' "$TARGET" | cut -d= -f2-)
DB_ROOT=$(grep -E '^DB_ROOT_PASSWORD=' "$TARGET" | cut -d= -f2-)

PASS_HASH=$(docker run --rm -e P="$ADMIN_PASS" node:22-alpine sh -c "npm install --silent bcrypt@5.1.1 >/dev/null 2>&1 && node -e \"console.log(require('bcrypt').hashSync(process.env.P, 12))\"")

docker compose exec -T mariadb mariadb -uroot -p"$DB_ROOT" "$DB_NAME" <<SQL
INSERT INTO Accounts (username, password, role, enabled, created_at, updated_at)
VALUES ('${ADMIN_USER}', '${PASS_HASH}', 'admin', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE password=VALUES(password), updated_at=NOW();
SQL

c "install complete"
cat <<EOF

Next:
  ./service.sh up
  open https://<your reverse proxy host>
  login: ${ADMIN_USER} / ${ADMIN_PASS}

DKIM key generation per domain (run after adding a domain in the UI):
  ./service.sh exec opendkim sh -c '
    D=example.com; S=dkim_\$(date +%Y_%m)
    mkdir -p /etc/opendkim/keys/\$D
    opendkim-genkey -b 2048 -d \$D -s \$S -D /etc/opendkim/keys/\$D
    echo "\${S}._domainkey.\${D} \${D}:\${S}:/etc/opendkim/keys/\${D}/\${S}.private" >> /etc/opendkim/key.table
    echo "*@\${D} \${S}._domainkey.\${D}" >> /etc/opendkim/signing.table
    cat /etc/opendkim/keys/\$D/\$S.txt
  '
  ./service.sh restart opendkim

EOF
