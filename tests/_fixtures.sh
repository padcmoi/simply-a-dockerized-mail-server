#!/usr/bin/env bash
# Recipient fixtures: at1..at6@<TEST_DOMAIN>. Created in MariaDB (the
# manager-api side is bypassed on purpose so a broken api does not block
# the suite), pre-equipped with every standard mailbox + a writable sieve
# dir, and torn down at the end.

create_recipients() {
  section "Provisioning ${#TEST_USERS[@]} test recipients in $TEST_DOMAIN"
  # install.sh no longer seeds a primary domain (the root account is expected
  # to create domains from the manager-ui), so the FK `virtual_users.domain
  # -> virtual_domains.domain` would reject the recipient INSERTs below
  # against a freshly-installed stack. Upsert the TEST_DOMAIN row first.
  docker exec -i mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" mailserver >>"$LOG_FILE" 2>&1 <<SQL
INSERT INTO virtual_domains (domain, quota, active, user_start_date)
VALUES ('$TEST_DOMAIN', $((10 * 1024 * 1024 * 1024)), 1, '1970-01-01')
ON DUPLICATE KEY UPDATE active = 1;
SQL
  local pw_hash
  pw_hash=$(openssl passwd -6 -salt "mailtest$$" "$TEST_PASSWORD")
  for user in "${TEST_USERS[@]}"; do
    docker exec -i mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" mailserver >>"$LOG_FILE" 2>&1 <<SQL
INSERT INTO virtual_users (owner_id, domain, email, password, maildir, quota, active, uid, gid, user_start_date)
VALUES (NULL, '$TEST_DOMAIN', '${user}@${TEST_DOMAIN}', '{SHA512-CRYPT}${pw_hash}', '${TEST_DOMAIN}/${user}/', 1073741824, 1, 'vmail', 'vmail', '1970-01-01')
ON DUPLICATE KEY UPDATE password = VALUES(password), active = 1;
SQL
  done
  docker exec -i mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" mailserver >>"$LOG_FILE" 2>&1 <<SQL
UPDATE virtual_quota_users SET bytes = 0, messages = 0 WHERE email LIKE 'at%@$TEST_DOMAIN';
UPDATE virtual_quota_domains SET bytes = 0, messages = 0 WHERE domain = '$TEST_DOMAIN';
SQL
  # Pre-create every standard mailbox so doveadm save / IMAP MOVE never
  # bail out with "Mailbox doesn't exist". DA / DF are the user folders
  # the AUTOROUTER tests target.
  for user in "${TEST_USERS[@]}"; do
    for box in INBOX Drafts Sent Junk Trash Archive DA DF; do
      docker exec mail-dovecot doveadm mailbox create -u "${user}@${TEST_DOMAIN}" -s "$box" >/dev/null 2>&1 || true
    done
    docker exec mail-dovecot mkdir -p "/var/mail/vhosts/${TEST_DOMAIN}/${user}/sieve" >/dev/null 2>&1
    docker exec mail-dovecot sh -c "touch /var/mail/vhosts/${TEST_DOMAIN}/${user}/sieve/roundcube.sieve && ln -sf sieve/roundcube.sieve /var/mail/vhosts/${TEST_DOMAIN}/${user}/.dovecot.sieve" >/dev/null 2>&1
    docker exec mail-dovecot chown -R vmail:vmail "/var/mail/vhosts/${TEST_DOMAIN}/${user}" >/dev/null 2>&1
  done
}

cleanup_recipients() {
  section "Tearing down test recipients"
  for user in "${TEST_USERS[@]}"; do
    docker exec mail-dovecot rm -rf "/var/mail/vhosts/${TEST_DOMAIN}/${user}" >/dev/null 2>&1 || true
    docker exec -i mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" mailserver >>"$LOG_FILE" 2>&1 <<SQL
DELETE FROM virtual_quota_users WHERE email = '${user}@${TEST_DOMAIN}';
DELETE FROM virtual_users       WHERE email = '${user}@${TEST_DOMAIN}';
SQL
    docker exec mail-redis sh -c "redis-cli --scan --pattern '*${user}@${TEST_DOMAIN}*' | xargs -r redis-cli DEL" >/dev/null 2>&1 || true
  done
  docker exec mail-redis sh -c "redis-cli --scan --pattern 'senders:autoroute-victim*' | xargs -r redis-cli DEL" >/dev/null 2>&1 || true
}
