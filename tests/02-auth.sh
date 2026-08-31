#!/usr/bin/env bash
# Authentication on the SMTP submission ports, IMAPS and ManageSieve.

t_smtp_auth_587() {
  section "SMTP authentication"
  if py - <<PY 2>>"$LOG_FILE"
import smtplib, ssl
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
s = smtplib.SMTP("$TEST_HOST", 587, timeout=20); s.starttls(context=ctx)
s.login("$(email_of at1)", "$TEST_PASSWORD"); s.quit()
PY
  then pass "smtp.auth.587" "AUTH OK"; else fail "smtp.auth.587" "login refused"; fi
}

t_smtp_auth_465() {
  if py - <<PY 2>>"$LOG_FILE"
import smtplib, ssl
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
s = smtplib.SMTP_SSL("$TEST_HOST", 465, context=ctx, timeout=20)
s.login("$(email_of at1)", "$TEST_PASSWORD"); s.quit()
PY
  then pass "smtp.auth.465" "AUTH OK"; else fail "smtp.auth.465" "login refused"; fi
}

t_imap_login_993() {
  section "IMAP / ManageSieve"
  if py - <<PY 2>>"$LOG_FILE"
import imaplib, ssl
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
m = imaplib.IMAP4_SSL("$TEST_HOST", 993, ssl_context=ctx)
m.login("$(email_of at1)", "$TEST_PASSWORD"); m.select("INBOX"); m.logout()
PY
  then pass "imap.login.993" "OK"; else fail "imap.login.993" "login failed"; fi
}

t_managesieve_login() {
  # Port 4190 is bridge-only; talk to it from inside the dovecot container
  # using netcat (Alpine ships `nc`).
  local banner
  banner=$(docker exec mail-dovecot sh -c '(echo LOGOUT; sleep 0.3) | nc -w 2 127.0.0.1 4190' 2>/dev/null)
  if printf '%s' "$banner" | grep -q 'IMPLEMENTATION\|OK\|Dovecot'; then
    pass "managesieve.banner" "banner received"
  else
    fail "managesieve.banner" "no banner (got: $(printf '%s' "$banner" | head -c 80))"
  fi
}

# user_start_date / user_end_date together define the activity window on a
# virtual_users row. A row is treated as active=0 outside the window. NULL
# end = unlimited; the start column is NOT NULL with default 1970-01-01.
# This drives a matrix of 10 cases against both the dovecot passdb (IMAP
# login) and the postfix virtual_mailbox_maps lookup (inbound delivery).
t_user_activity_window() {
  section "User activity window (user_start_date / user_end_date)"
  local email; email=$(email_of at1)
  local sql="docker exec -i mail-mariadb mariadb -uroot -p${DB_ROOT_PASSWORD} mailserver"

  imap_login_ok() {
    py - <<PY 2>>"$LOG_FILE"
import imaplib, ssl, sys
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
try:
    m = imaplib.IMAP4_SSL("$TEST_HOST", 993, ssl_context=ctx)
    m.login("$email", "$TEST_PASSWORD")
    m.logout()
except Exception:
    sys.exit(1)
PY
  }
  pf_mailbox_hit() {
    docker exec mail-postfix postmap -q "$email" mysql:/etc/postfix/sql/mysql-virtual-mailboxes.cf 2>/dev/null
  }

  # Each row: label|start_sql|end_sql|expected_state ("active"|"inactive").
  # CURDATE() / DATE_ADD / DATE_SUB are evaluated server side; keep the SQL
  # literal compact (no padding) so the row stays untouched downstream.
  local cases=(
    "epoch.no_end|'1970-01-01'|NULL|active"
    "epoch.end_past|'1970-01-01'|DATE_SUB(CURDATE(),INTERVAL 1 DAY)|inactive"
    "epoch.end_today|'1970-01-01'|CURDATE()|active"
    "epoch.end_future|'1970-01-01'|DATE_ADD(CURDATE(),INTERVAL 30 DAY)|active"
    "start_today.no_end|CURDATE()|NULL|active"
    "start_today.end_today|CURDATE()|CURDATE()|active"
    "start_future.no_end|DATE_ADD(CURDATE(),INTERVAL 1 DAY)|NULL|inactive"
    "start_future.end_future|DATE_ADD(CURDATE(),INTERVAL 1 DAY)|DATE_ADD(CURDATE(),INTERVAL 30 DAY)|inactive"
    "start_past.end_past|DATE_SUB(CURDATE(),INTERVAL 1 DAY)|DATE_SUB(CURDATE(),INTERVAL 1 DAY)|inactive"
    "start_future.end_past|DATE_ADD(CURDATE(),INTERVAL 1 DAY)|DATE_SUB(CURDATE(),INTERVAL 1 DAY)|inactive"
  )

  local row label start_sql end_sql expected
  for row in "${cases[@]}"; do
    IFS='|' read -r label start_sql end_sql expected <<<"$row"
    echo "UPDATE virtual_users SET user_start_date=$start_sql, user_end_date=$end_sql WHERE email='$email';" | $sql >/dev/null
    local imap_state pf_state
    if imap_login_ok; then imap_state=active; else imap_state=inactive; fi
    if [[ -n "$(pf_mailbox_hit)" ]]; then pf_state=active; else pf_state=inactive; fi
    if [[ "$imap_state" == "$expected" ]]; then pass "window.${label}.imap" "$expected"; else fail "window.${label}.imap" "expected=$expected got=$imap_state (start=$start_sql end=$end_sql)"; fi
    if [[ "$pf_state"   == "$expected" ]]; then pass "window.${label}.postfix" "$expected"; else fail "window.${label}.postfix" "expected=$expected got=$pf_state (start=$start_sql end=$end_sql)"; fi
  done

  # Reset for downstream tests
  echo "UPDATE virtual_users SET user_start_date='1970-01-01', user_end_date=NULL WHERE email='$email';" | $sql >/dev/null
}

t_smtp_auth_587
t_smtp_auth_465
t_imap_login_993
t_managesieve_login
t_user_activity_window
