#!/usr/bin/env bash
# Roundcube: login page + IMAP link to dovecot + dovecot-lda respects the
# user's sieve (regression coverage for the postmaster-notification
# pathway introduced when 40-notify.sh moved from doveadm save to LDA).

t_roundcube_login_page() {
  section "Roundcube"
  local code
  code=$(docker exec mail-roundcube curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ 2>/dev/null)
  if [[ "$code" =~ ^(200|302)$ ]]; then
    pass "roundcube.login_page" "HTTP $code"
  else
    fail "roundcube.login_page" "HTTP $code"
  fi
}

t_roundcube_imap_proxy() {
  local out
  out=$(docker exec mail-roundcube sh -c 'echo | timeout 3 openssl s_client -quiet -connect mail-dovecot:993 -CAfile /etc/ssl/certs/ca-certificates.crt 2>/dev/null | head -1' 2>/dev/null)
  if printf '%s' "$out" | grep -q '* OK'; then
    pass "roundcube.dovecot_link" "IMAP banner reached"
  else
    fail "roundcube.dovecot_link" "no IMAP banner ($out)"
  fi
}

t_lda_respects_sieve() {
  docker exec -i mail-dovecot sh -c "cat > /var/mail/vhosts/${TEST_DOMAIN}/at6/sieve/roundcube.sieve" <<'EOF'
require ["fileinto"];
# rule:[AUTOROUTER DA pretend-postmaster@example.com]
if allof (address :is "From" "pretend-postmaster@example.com")
{
	fileinto "DA";
	stop;
}
EOF
  docker exec mail-dovecot sh -c "rm -f /var/mail/vhosts/${TEST_DOMAIN}/at6/sieve/roundcube.svbin && chown -R vmail:vmail /var/mail/vhosts/${TEST_DOMAIN}/at6" >/dev/null 2>&1
  local subj="lda-routing-$$"
  docker exec -i mail-dovecot /usr/libexec/dovecot/dovecot-lda -d "$(email_of at6)" -f "pretend-postmaster@example.com" >>"$LOG_FILE" 2>&1 <<EOF
From: pretend-postmaster@example.com
To: $(email_of at6)
Subject: $subj
Date: Sun, 28 Jun 2026 18:40:00 +0000
Message-ID: <$subj@example.com>

body
EOF
  sleep 2
  local found=""
  for box in DA INBOX Junk; do
    if mailbox_has_subject at6 "$box" "$subj"; then found="$box"; break; fi
  done
  if [[ "$found" == "DA" ]]; then
    pass "lda.respects_user_sieve" "fileinto DA fired"
  else
    fail "lda.respects_user_sieve" "landed in: ${found:-nowhere}"
  fi
}

t_roundcube_login_page
t_roundcube_imap_proxy
t_lda_respects_sieve
