#!/usr/bin/env bash
# AUTOROUTER (imap_sieve triggers 3 + 4):
#   * INBOX -> user folder       => upsert AUTOROUTER rule
#   * user folder -> INBOX       => delete the rule
#   * system folder -> INBOX     => keep the rule (Junk unblock, undelete,
#                                   unarchive, draft-edit, all left alone)

t_autorouter_create() {
  section "AUTOROUTER triggers"
  docker exec mail-dovecot sh -c "echo > /var/mail/vhosts/${TEST_DOMAIN}/at4/sieve/roundcube.sieve && rm -f /var/mail/vhosts/${TEST_DOMAIN}/at4/sieve/roundcube.svbin && chown vmail:vmail /var/mail/vhosts/${TEST_DOMAIN}/at4/sieve/roundcube.sieve" >/dev/null 2>&1
  inject_mail at4 INBOX "autoroute-victim@example.com" "autoroute-c-$$"
  imap_move at4 INBOX DA >/dev/null 2>&1 || true
  local hit=0
  for _ in $(seq 1 10); do
    if sieve_script at4 | grep -q 'AUTOROUTER DA autoroute-victim@example.com'; then hit=1; break; fi
    sleep 1
  done
  if [[ $hit -eq 1 ]]; then
    pass "autorouter.create" "rule created INBOX->DA"
  else
    fail "autorouter.create" "rule not written; script: $(sieve_script at4 | tr '\n' '|')"
  fi
}

t_autorouter_update() {
  inject_mail at4 INBOX "autoroute-victim@example.com" "autoroute-u-$$"
  imap_move at4 INBOX DF >/dev/null 2>&1 || true
  local has_df=0 has_da=0
  for _ in $(seq 1 10); do
    sieve_script at4 | grep -q 'AUTOROUTER DF autoroute-victim@example.com' && has_df=1 || true
    sieve_script at4 | grep -q 'AUTOROUTER DA autoroute-victim@example.com' && has_da=1 || true
    [[ $has_df -eq 1 && $has_da -eq 0 ]] && break
    sleep 1
  done
  if [[ $has_df -eq 1 && $has_da -eq 0 ]]; then
    pass "autorouter.update" "rule moved DA -> DF without duplicate"
  else
    fail "autorouter.update" "DF=$has_df DA=$has_da; script: $(sieve_script at4 | tr '\n' '|')"
  fi
}

t_autorouter_undo_user_folder() {
  inject_mail at4 DF "autoroute-victim@example.com" "autoroute-undo-$$"
  imap_move at4 DF INBOX >/dev/null 2>&1 || true
  local cleared=0
  for _ in $(seq 1 10); do
    sieve_script at4 | grep -q 'AUTOROUTER .* autoroute-victim@example.com' || { cleared=1; break; }
    sleep 1
  done
  if [[ $cleared -eq 1 ]]; then
    pass "autorouter.undo_user" "DF -> INBOX removed the rule"
  else
    fail "autorouter.undo_user" "rule still present"
  fi
}

t_autorouter_keep_on_system_source() {
  inject_mail at4 INBOX "autoroute-victim@example.com" "autoroute-recreate-$$"
  imap_move at4 INBOX DA >/dev/null 2>&1 || true
  sleep 2
  for src in Junk Trash Drafts Archive; do
    inject_mail at4 "$src" "autoroute-victim@example.com" "autoroute-sys-$src-$$" "X-Spam-Flag: YES"
    imap_move at4 "$src" INBOX >/dev/null 2>&1 || true
    sleep 1
    if sieve_script at4 | grep -q 'AUTOROUTER DA autoroute-victim@example.com'; then
      pass "autorouter.keep_on.$src" "rule preserved"
    else
      fail "autorouter.keep_on.$src" "rule wrongly deleted by $src -> INBOX"
      inject_mail at4 INBOX "autoroute-victim@example.com" "autoroute-reseed-$src-$$"
      imap_move at4 INBOX DA >/dev/null 2>&1 || true
      sleep 1
    fi
  done
}

t_autorouter_create
t_autorouter_update
t_autorouter_undo_user_folder
t_autorouter_keep_on_system_source
