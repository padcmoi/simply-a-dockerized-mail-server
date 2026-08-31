#!/usr/bin/env bash
# End-to-end delivery: SMTP -> postfix milter chain -> dovecot LMTP ->
# user mailbox. Also verifies DKIM signing on the outbound side and the
# DKIM sidecar API is reachable.

t_delivery_basic() {
  section "Mail delivery + DKIM"
  local subj="delivery-basic-$$"
  smtp_send "$(email_of at1)" "$(email_of at2)" "$subj" "" "hello"
  local found=""
  for _ in $(seq 1 20); do
    for box in INBOX Junk Drafts Sent Trash Archive; do
      if mailbox_has_subject at2 "$box" "$subj"; then found="$box"; break 2; fi
    done
    sleep 1
  done
  if [[ -n "$found" ]]; then
    pass "delivery.smtp_to_imap" "delivered to $found"
  else
    local q; q=$(docker exec mail-postfix mailq 2>/dev/null | head -3 | tr '\n' '|')
    fail "delivery.smtp_to_imap" "no message; postfix queue head=$q"
  fi
}

t_dkim_signature_added() {
  smtp_send "$(email_of at1)" "$(email_of at2)" "dkim-check-$$" ""
  local found_box=""
  for _ in $(seq 1 10); do
    for box in INBOX Junk; do
      if mailbox_has_subject at2 "$box" "dkim-check-$$"; then found_box="$box"; break 2; fi
    done
    sleep 1
  done
  if [[ -n "$found_box" ]]; then
    local hdrs
    hdrs=$(docker exec mail-dovecot doveadm fetch -u "$(email_of at2)" hdr mailbox "$found_box" subject "dkim-check-$$" 2>/dev/null)
    assert_contains "dkim.signature_header" "DKIM-Signature:" "$hdrs"
  else
    fail "dkim.signature_header" "no message delivered"
  fi
}

t_dkim_api_sidecar() {
  # Probe the sidecar reachability via the same path manager-api / install
  # .sh use. Any HTTP response (2xx / 4xx) counts: a connection refused
  # would indicate the sidecar is down.
  local raw status
  raw=$(docker exec mail-opendkim sh -c 'curl -s -o /tmp/dkim-probe -w "%{http_code}" "http://127.0.0.1:8080/list?domain='"$TEST_DOMAIN"'" 2>/dev/null; cat /tmp/dkim-probe 2>/dev/null; rm -f /tmp/dkim-probe' 2>/dev/null)
  status=$(printf '%s' "$raw" | head -c 3)
  if [[ "$status" =~ ^(200|404|405)$ ]]; then
    pass "dkim.api.sidecar" "HTTP $status (sidecar reachable)"
  else
    fail "dkim.api.sidecar" "HTTP=$status raw=$(printf '%s' "$raw" | head -c 80)"
  fi
}

t_delivery_basic
t_dkim_signature_added
t_dkim_api_sidecar
