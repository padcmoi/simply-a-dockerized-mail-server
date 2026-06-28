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

t_smtp_auth_587
t_smtp_auth_465
t_imap_login_993
t_managesieve_login
