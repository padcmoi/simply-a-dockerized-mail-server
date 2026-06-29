#!/usr/bin/env bash
# Postfix attachment cap and dovecot quota tracking via virtual_quota_users.

t_attachment_size_limit() {
  section "Attachment cap + quota tracking"
  local mb expected actual
  mb=$(grep '^ATTACHMENT_MAX_SIZE_MB=' "$PROJECT_DIR/.env" | cut -d= -f2)
  expected=$(( ${mb:-25} * 1024 * 1024 ))
  actual=$(docker exec mail-postfix postconf -h message_size_limit 2>/dev/null)
  assert_eq "attachments.message_size_limit" "$expected" "$actual"
}

t_quota_updates() {
  local before after
  before=$(docker exec mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" -BN mailserver -e "SELECT COALESCE(bytes,0) FROM virtual_quota_users WHERE email='$(email_of at2)'" 2>/dev/null)
  inject_mail at2 INBOX "quota-probe@example.com" "quota-$$" "" "$(printf 'A%.0s' {1..1024})"
  sleep 2
  after=$(docker exec mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" -BN mailserver -e "SELECT COALESCE(bytes,0) FROM virtual_quota_users WHERE email='$(email_of at2)'" 2>/dev/null)
  if [[ "${after:-0}" -gt "${before:-0}" ]]; then
    pass "quota.bytes_increased" "$before -> $after"
  else
    fail "quota.bytes_increased" "no change ($before -> $after)"
  fi
}

t_attachment_size_limit
t_quota_updates
