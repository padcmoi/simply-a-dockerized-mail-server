#!/usr/bin/env bash
# Sieve pipeline:
#   * sieve_default -> default.sieve fileinto INBOX
#   * sieve_before  -> spam-to-junk.sieve routes X-Spam-Flag to Junk before
#                      the user script
#   * managesieve PUTSCRIPT / GETSCRIPT round-trip (Roundcube data path)

t_sieve_default() {
  section "Sieve global + user"
  # Deliver through dovecot-lda so the full sieve pipeline runs
  # regardless of any SMTP scoring quirks.
  docker exec -i mail-dovecot /usr/libexec/dovecot/dovecot-lda -d "$(email_of at3)" -f "lda-default-sender@example.com" >>"$LOG_FILE" 2>&1 <<EOF
From: lda-default-sender@example.com
To: $(email_of at3)
Subject: sieve-default-$$
Date: Sun, 28 Jun 2026 18:00:00 +0000
Message-ID: <sieve-default-$$@example.com>

body
EOF
  if wait_for 10 mailbox_has_subject at3 INBOX "sieve-default-$$"; then
    pass "sieve.default_into_inbox" "OK"
  else
    fail "sieve.default_into_inbox" "no message in INBOX"
  fi
}

t_sieve_spam_to_junk() {
  docker exec -i mail-dovecot /usr/libexec/dovecot/dovecot-lda -d "$(email_of at3)" -f "lda-spam-sender@example.com" >>"$LOG_FILE" 2>&1 <<EOF
From: lda-spam-sender@example.com
To: $(email_of at3)
Subject: spam-junk-$$
X-Spam-Flag: YES
Date: Sun, 28 Jun 2026 18:00:00 +0000
Message-ID: <spam-junk-$$@example.com>

body
EOF
  if wait_for 12 mailbox_has_subject at3 Junk "spam-junk-$$"; then
    pass "sieve.spam_to_junk" "X-Spam-Flag mail landed in Junk"
  else
    fail "sieve.spam_to_junk" "mail did not reach Junk"
  fi
}

t_managesieve_putscript() {
  # doveadm sieve put/get/delete -- same backend Roundcube's managesieve
  # plugin writes through.
  local user; user="$(email_of at1)"
  docker exec -i mail-dovecot doveadm sieve put -u "$user" -a probe-managesieve <<'EOF' >>"$LOG_FILE" 2>&1
require ["fileinto"];
# rule:[probe-managesieve]
if allof (header :contains "subject" "probeXYZ")
{
	fileinto "INBOX";
}
EOF
  local got
  got=$(docker exec mail-dovecot doveadm sieve get -u "$user" probe-managesieve 2>/dev/null)
  if printf '%s' "$got" | grep -q probeXYZ; then
    pass "managesieve.putscript_getscript" "round-trip OK"
  else
    fail "managesieve.putscript_getscript" "got=$(printf '%s' "$got" | tr '\n' ' ' | head -c 120)"
  fi
  docker exec mail-dovecot doveadm sieve delete -u "$user" probe-managesieve >/dev/null 2>&1 || true
}

t_sieve_default
t_sieve_spam_to_junk
t_managesieve_putscript
