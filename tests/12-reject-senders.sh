#!/usr/bin/env bash
# Postfix SQL blacklist via the sieve_reject_senders table. Two lookup
# files are wired in smtpd_sender_restrictions:
#   * mysql-sender-blacklist.cf         -> match on exact email
#   * mysql-sender-blacklist-domain.cf  -> match on @domain rows
# The blocked path triggers at MAIL FROM time; bypassed by permit_mynetworks
# for in-bridge senders. We exercise the lookup with `postmap -q` (same SQL
# postfix runs at restriction time, no mynetworks short-circuit) and assert
# the REJECT verb is or is not returned.
#
# Test fixtures inserted then torn down. Picks distinctive sender strings
# that no real test mail uses, so an aborted prior run never leaks state.

t_reject_senders() {
  section "Postfix sender blacklist (sieve_reject_senders)"
  local sql="docker exec -i mail-mariadb mariadb -uroot -p${DB_ROOT_PASSWORD} mailserver"
  local victim="blacklist-test@spam-fixture.invalid"
  local domain="spam-domain-fixture.invalid"
  pf_email() {
    docker exec mail-postfix postmap -q "$1" mysql:/etc/postfix/sql/mysql-sender-blacklist.cf 2>/dev/null
  }
  pf_domain() {
    docker exec mail-postfix postmap -q "$1" mysql:/etc/postfix/sql/mysql-sender-blacklist-domain.cf 2>/dev/null
  }

  # Baseline: nothing blacklisted yet -> both lookups must return empty
  echo "DELETE FROM sieve_reject_senders WHERE sender IN ('$victim','@$domain');" | $sql >/dev/null
  if [[ -z "$(pf_email "$victim")" ]]; then pass "reject.baseline.email" "no hit"; else fail "reject.baseline.email" "unexpected hit"; fi
  if [[ -z "$(pf_domain "anyone@$domain")" ]]; then pass "reject.baseline.domain" "no hit"; else fail "reject.baseline.domain" "unexpected hit"; fi

  # Insert exact-email row, enabled -> exact match hits, domain lookup stays empty
  echo "INSERT INTO sieve_reject_senders (sender, enabled) VALUES ('$victim', 1);" | $sql >/dev/null
  if [[ "$(pf_email "$victim")" == "REJECT Sender blacklisted" ]]; then
    pass "reject.email.hit" "REJECT returned"
  else
    fail "reject.email.hit" "got '$(pf_email "$victim")'"
  fi
  if [[ -z "$(pf_email "clean@spam-fixture.invalid")" ]]; then
    pass "reject.email.miss" "non-listed sender ignored"
  else
    fail "reject.email.miss" "non-listed sender unexpectedly matched"
  fi

  # Toggle the row off -> lookup must return empty (manager-api PATCH path)
  echo "UPDATE sieve_reject_senders SET enabled=0 WHERE sender='$victim';" | $sql >/dev/null
  if [[ -z "$(pf_email "$victim")" ]]; then
    pass "reject.email.disabled" "enabled=0 ignored"
  else
    fail "reject.email.disabled" "enabled=0 still hits"
  fi

  # Insert domain row -> any user@domain on the domain-lookup hits, exact-lookup misses
  echo "INSERT INTO sieve_reject_senders (sender, enabled) VALUES ('@$domain', 1);" | $sql >/dev/null
  if [[ "$(pf_domain "anyone@$domain")" == "REJECT Sender domain blacklisted" ]]; then
    pass "reject.domain.hit" "REJECT returned"
  else
    fail "reject.domain.hit" "got '$(pf_domain "anyone@$domain")'"
  fi
  if [[ -z "$(pf_domain "anyone@clean-domain.invalid")" ]]; then
    pass "reject.domain.miss" "non-listed domain ignored"
  else
    fail "reject.domain.miss" "non-listed domain unexpectedly matched"
  fi

  # Cleanup
  echo "DELETE FROM sieve_reject_senders WHERE sender IN ('$victim','@$domain');" | $sql >/dev/null
}

t_reject_senders
