#!/usr/bin/env bash
# rspamd USER_BLOCKLIST + GLOBAL_BLOCKLIST + postmaster notification +
# priority of sieve_before over the user's AUTOROUTER rules.

t_user_blocklist_threshold() {
  section "rspamd USER_BLOCKLIST + GLOBAL_BLOCKLIST"
  local from="blocklist-sender@mail-tester.com"
  for i in 1 2 3; do
    inject_mail at5 INBOX "$from" "blk-$i-$$"
    imap_move at5 INBOX Junk >/dev/null 2>&1
    sleep 1
  done
  sleep 2
  local count
  count=$(redis_get GET "spam_count:$(email_of at5):$from")
  [[ "${count:-0}" -ge 3 ]] && pass "blocklist.spam_count" "count=$count" \
                            || fail "blocklist.spam_count" "count=${count:-nil} (expected >=3)"

  # 4th mail must land in Junk. Send via port 25 (no AUTH) from inside the
  # docker bridge so the milter chain sees the real From header, not at1.
  local subj="blk-4-$$"
  py - <<PY >>"$LOG_FILE" 2>&1
import smtplib
msg = (
  f"From: {'$from'}\r\n"
  f"To: $(email_of at5)\r\n"
  f"Subject: {'$subj'}\r\n"
  f"Date: Sun, 28 Jun 2026 18:00:00 +0000\r\n\r\nbody\r\n"
)
s = smtplib.SMTP("$TEST_HOST", 25, timeout=20)
s.sendmail("$from", ["$(email_of at5)"], msg)
s.quit()
PY
  local landed=""
  for _ in $(seq 1 25); do
    for box in Junk INBOX; do
      if mailbox_has_subject at5 "$box" "$subj"; then landed="$box"; break 2; fi
    done
    sleep 1
  done
  if [[ "$landed" == "Junk" ]]; then
    pass "blocklist.fourth_mail_to_junk" "OK"
  else
    fail "blocklist.fourth_mail_to_junk" "landed in: ${landed:-nowhere}"
  fi
}

t_postmaster_notification() {
  # 40-notify.sh dropped a "Sender ... auto-routed to Junk" mail in at5's
  # INBOX (no AUTOROUTER rule for postmaster on at5 yet, so default INBOX).
  if wait_for 10 mailbox_has_subject at5 INBOX "is now auto-routed to Junk"; then
    pass "blocklist.postmaster_notification" "delivered"
  else
    fail "blocklist.postmaster_notification" "no notification mail seen"
  fi
}

t_priority_blocklist_over_autorouter() {
  # at5 has spam_count >= 3. Pretend the user ALSO has an AUTOROUTER rule
  # for the same blocklisted sender -> DA. The next inbound mail must still
  # land in Junk because sieve_before -> spam-to-junk runs ahead of the
  # user script.
  docker exec mail-dovecot sh -c "mkdir -p /var/mail/vhosts/${TEST_DOMAIN}/at5/sieve && cat > /var/mail/vhosts/${TEST_DOMAIN}/at5/sieve/roundcube.sieve" <<'EOF'
require ["fileinto"];
# rule:[AUTOROUTER DA blocklist-sender@example.com]
if allof (address :is "From" "blocklist-sender@example.com")
{
	fileinto "DA";
	stop;
}
EOF
  docker exec mail-dovecot sh -c "ln -sf sieve/roundcube.sieve /var/mail/vhosts/${TEST_DOMAIN}/at5/.dovecot.sieve && chown -R vmail:vmail /var/mail/vhosts/${TEST_DOMAIN}/at5" >/dev/null 2>&1
  docker exec mail-dovecot sievec "/var/mail/vhosts/${TEST_DOMAIN}/at5/sieve/roundcube.sieve" >/dev/null 2>&1
  docker exec -i mail-dovecot /usr/libexec/dovecot/dovecot-lda -d "$(email_of at5)" -f "blocklist-sender@example.com" >>"$LOG_FILE" 2>&1 <<EOF
From: blocklist-sender@example.com
To: $(email_of at5)
Subject: prio-after-block-$$
Date: Sun, 28 Jun 2026 18:30:00 +0000
Message-ID: <prio-after-block-$$@example.com>
X-Spam-Flag: YES

body
EOF
  if wait_for 5 mailbox_has_subject at5 Junk "prio-after-block-$$"; then
    pass "priority.sieve_before_wins" "X-Spam-Flag -> Junk despite AUTOROUTER rule"
  else
    fail "priority.sieve_before_wins" "AUTOROUTER short-circuited spam-to-junk"
  fi
}

t_global_blocklist_consensus() {
  section "GLOBAL_BLOCKLIST 75% consensus"
  local from="consensus-spammer-$$@example.com"
  for u in at2 at3 at4 at5; do
    docker exec mail-dovecot doveadm mailbox create -u "${u}@${TEST_DOMAIN}" -s Junk >/dev/null 2>&1 || true
    inject_mail "$u" INBOX "$from" "consensus-$u-$$"
    docker exec mail-redis redis-cli SADD "senders:$from:recipients" "${u}@${TEST_DOMAIN}" >/dev/null 2>&1
  done
  sleep 1
  for u in at2 at3 at4; do
    imap_move "$u" INBOX Junk >/dev/null 2>&1
    sleep 1
  done
  sleep 2
  local reporters recipients
  reporters=$(redis_get SCARD "senders:$from:reporters")
  recipients=$(redis_get SCARD "senders:$from:recipients")
  [[ "${reporters:-0}" -ge 3 && "${recipients:-0}" -ge 4 ]] \
    && pass "global_blocklist.counts" "reporters=$reporters recipients=$recipients" \
    || fail "global_blocklist.counts" "reporters=$reporters recipients=$recipients"
}

t_user_blocklist_threshold
t_postmaster_notification
t_priority_blocklist_over_autorouter
t_global_blocklist_consensus
