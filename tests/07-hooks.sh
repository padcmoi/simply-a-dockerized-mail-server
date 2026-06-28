#!/usr/bin/env bash
# Hook-level checks for /images/dovecot/conf/sieve/bin/hooks/*.sh.
# The blocklist + AUTOROUTER tests already cover hooks 20/30/40 via their
# observable side effects; this file pins the bayes-training hook
# (10-bayes.sh) and the spam_count INCR/DEL contract of 20-user-blocklist.sh.

t_hook_10_bayes() {
  section "Hook 10-bayes.sh: per-user rspamd training"
  # rspamc -d <user> learn_spam materialises per-user bayes tokens in
  # Redis with prefix `RS<recipient>_<token_id>` (new_schema + per_user
  # selector = "rcpt:addr"). The body must clear rspamd's `min_tokens`
  # threshold (default 11), so we stuff it with spammy words.
  local from="hook-bayes-train-$$@mail-tester.com"
  # Rspamd refuses to re-train on a message whose body fingerprint it has
  # already seen, so we sprinkle the body with run-unique noise.
  local nonce; nonce="$(date +%s%N)-$RANDOM"
  local body="This is a test spam message $nonce with many tokens for the bayes classifier viagra cialis money free quick rich now buy click here amazing offer urgent limited time only act now wire transfer nigerian prince inheritance lottery winner congratulations claim prize today $nonce"
  inject_mail at1 INBOX "$from" "hook-bayes-train-$$" "" "$body"
  imap_move at1 INBOX Junk >/dev/null 2>&1
  local key=""
  for _ in $(seq 1 10); do
    key=$(docker exec mail-redis sh -c "redis-cli --scan --pattern 'RS$(email_of at1)_*' | head -1" 2>/dev/null)
    [[ -n "$key" ]] && break
    sleep 1
  done
  if [[ -n "$key" ]]; then
    pass "hook.10_bayes.per_user_tokens" "first key=$key"
  else
    fail "hook.10_bayes.per_user_tokens" "no per-user bayes tokens after learn_spam"
  fi
}

t_hook_20_user_blocklist() {
  section "Hook 20-user-blocklist.sh: spam_count INCR / DEL"
  local from="bayes-probe-$$@example.com"
  inject_mail at2 INBOX "$from" "bayes-spam-$$"
  imap_move at2 INBOX Junk >/dev/null 2>&1
  sleep 3
  local count
  count=$(redis_get GET "spam_count:$(email_of at2):$from")
  if [[ "${count:-0}" -ge 1 ]]; then
    pass "bayes.spam_count_incremented" "count=$count"
  else
    fail "bayes.spam_count_incremented" "count=${count:-nil}"
  fi
  # Junk -> INBOX => 20-user-blocklist.sh DELs the spam_count.
  imap_move at2 Junk INBOX >/dev/null 2>&1
  sleep 3
  local cleared
  cleared=$(redis_get GET "spam_count:$(email_of at2):$from")
  if [[ -z "$cleared" || "$cleared" == "0" ]]; then
    pass "bayes.learn_ham_clears_counter" "cleared"
  else
    fail "bayes.learn_ham_clears_counter" "still=$cleared"
  fi
}

t_hook_10_bayes
t_hook_20_user_blocklist
