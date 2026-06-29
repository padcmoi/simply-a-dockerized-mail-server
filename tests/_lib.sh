#!/usr/bin/env bash
# Shared helpers, counters and primitives used by every tests/[0-9]*.sh
# file. Sourced once by ../test-mailservers.sh BEFORE any test file is
# sourced.
#
# Globals defined here (read by every test file):
#   TEST_DOMAIN, TEST_HOST, TEST_PASSWORD, TEST_USERS[]
#   STACK_CONTAINERS[], HEALTH_CONTAINERS[]
#   REPORT_FILE, LOG_FILE, SCRATCH_DIR
#   PASS / FAIL / SKIP counters, RESULTS[] array
# Functions defined here:
#   log section pass fail skip assert_eq assert_contains
#   py email_of smtp_send inject_mail imap_move
#   mailbox_count mailbox_has_subject sieve_script redis_get wait_for

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "ERROR: .env missing - run ./install.sh first" >&2
  exit 2
fi

# shellcheck disable=SC2046
export $(grep -E '^(DB_USER|DB_PASSWORD|DB_ROOT_PASSWORD|MAIL_HOSTNAME|MAIL_PUBLIC_IP|TLS_CERT_NAME)=' "$PROJECT_DIR/.env" | xargs -d '\n' -I{} echo {})

TEST_DOMAIN="$(printf '%s' "${MAIL_HOSTNAME:-mail.gestionpratique.ovh}" | sed 's/^mail\.//')"
TEST_HOST="${MAIL_HOSTNAME:-mail.gestionpratique.ovh}"
TEST_PASSWORD='TestPass!1Setup'
TEST_USERS=("at1" "at2" "at3" "at4" "at5" "at6")

REPORT_FILE="${PROJECT_DIR}/test-results.md"
LOG_FILE="${PROJECT_DIR}/test.log"

STACK_CONTAINERS=(mail-mariadb mail-redis mail-clamav mail-opendkim mail-opendmarc mail-rspamd mail-dovecot mail-postfix mail-fail2ban mail-phpmyadmin mail-manager-api mail-manager-ui)
HEALTH_CONTAINERS=(mail-mariadb mail-redis mail-clamav mail-dovecot)

# Roundcube is shipped via the optional docker-compose.roundcube.yml overlay.
# Detect it at boot so the tests can switch between "assert running" and
# "skip cleanly" without the suite ever red-flagging a container the user
# chose not to deploy.
ROUNDCUBE_PRESENT=0
if docker inspect mail-roundcube >/dev/null 2>&1; then
  ROUNDCUBE_PRESENT=1
  STACK_CONTAINERS+=(mail-roundcube)
fi

# ---------- output / counters ----------
COLOR_OFF=$'\033[0m'
COLOR_GREEN=$'\033[0;32m'
COLOR_RED=$'\033[0;31m'
COLOR_YELLOW=$'\033[0;33m'
COLOR_GRAY=$'\033[0;90m'

PASS=0; FAIL=0; SKIP=0
RESULTS=()

stamp() { date +%H:%M:%S; }
log()   { printf '%s %s\n' "$(stamp)" "$*" | tee -a "$LOG_FILE" >&2; }
section() { printf '\n%s== %s ==%s\n' "$COLOR_GRAY" "$1" "$COLOR_OFF" | tee -a "$LOG_FILE" >&2; }
pass()  { RESULTS+=("- \`PASS\` **$1** -- $2"); PASS=$((PASS+1));
          printf '  %sPASS%s %s\n' "$COLOR_GREEN" "$COLOR_OFF" "$1" | tee -a "$LOG_FILE" >&2; }
fail()  { RESULTS+=("- \`FAIL\` **$1** -- $2"); FAIL=$((FAIL+1));
          printf '  %sFAIL%s %s -- %s\n' "$COLOR_RED" "$COLOR_OFF" "$1" "$2" | tee -a "$LOG_FILE" >&2; }
skip()  { RESULTS+=("- \`SKIP\` **$1** -- $2"); SKIP=$((SKIP+1));
          printf '  %sSKIP%s %s -- %s\n' "$COLOR_YELLOW" "$COLOR_OFF" "$1" "$2" | tee -a "$LOG_FILE" >&2; }

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then pass "$name" "$expected"; else fail "$name" "expected=$expected got=$actual"; fi
}
assert_contains() {
  local name="$1" needle="$2" haystack="$3"
  if printf '%s' "$haystack" | grep -qF "$needle"; then pass "$name" "found '$needle'"; else fail "$name" "missing '$needle'"; fi
}

# ---------- mail-protocol primitives ----------
py() { python3 "$@"; }

email_of() { echo "${1}@${TEST_DOMAIN}"; }

# Send a mail via SMTP submission (587 STARTTLS, AUTH PLAIN).
smtp_send() {
  local sender="$1" recipient="$2" subject="$3" extra_header="${4:-}" body="${5:-test body}"
  py - <<PY 2>>"$LOG_FILE"
import smtplib, ssl
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
msg = (
  f"From: {'$sender'}\r\n"
  f"To: {'$recipient'}\r\n"
  f"Subject: {'$subject'}\r\n"
  f"Date: Sun, 28 Jun 2026 18:00:00 +0000\r\n"
  f"{'$extra_header'}"
  + ("\r\n" if '$extra_header' else "")
  + "\r\n"
  + '$body'
)
s = smtplib.SMTP("$TEST_HOST", 587, timeout=20)
s.starttls(context=ctx)
s.login('$sender', '$TEST_PASSWORD')
s.sendmail('$sender', ['$recipient'], msg)
s.quit()
PY
}

# Direct injection via doveadm save -- bypasses sieve. Use to stage
# messages in INBOX / Junk / DA without the full delivery chain. Builds
# the RFC 5322 envelope by hand so an empty `extra_header` does not
# inject a spurious blank line between the headers and the body (which
# would make rspamd's bayes parser treat the body as part of the headers
# and report `less tokens than required`).
inject_mail() {
  local user="$1" mailbox="$2" sender="$3" subject="$4" extra_header="${5:-}" body="${6:-}"
  {
    printf 'From: %s\r\n' "$sender"
    printf 'To: %s@%s\r\n' "$user" "$TEST_DOMAIN"
    printf 'Subject: %s\r\n' "$subject"
    printf 'Date: Sun, 28 Jun 2026 18:00:00 +0000\r\n'
    printf 'Message-ID: <inj-%s-%s-%s@test.invalid>\r\n' "$RANDOM" "$$" "$(date +%s%N)"
    [[ -n "$extra_header" ]] && printf '%s\r\n' "$extra_header"
    printf '\r\n%s\r\n' "$body"
  } | docker exec -i mail-dovecot doveadm save -u "${user}@${TEST_DOMAIN}" -m "$mailbox"
}

# Real IMAP COPY+EXPUNGE so imap_sieve triggers fire. Picks the LATEST
# message (so tests that inject right before this helper land on the
# right fixture even when the mailbox already has unrelated messages).
imap_move() {
  local user="$1" src="$2" dst="$3"
  py - <<PY 2>>"$LOG_FILE"
import imaplib, ssl, sys
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
m = imaplib.IMAP4_SSL("$TEST_HOST", 993, ssl_context=ctx)
m.login("${user}@${TEST_DOMAIN}", "$TEST_PASSWORD")
m.select("$src")
typ, data = m.search(None, "ALL")
ids = data[0].split()
if not ids:
    print("EMPTY", file=sys.stderr); sys.exit(2)
uid = ids[-1]
m.copy(uid, "$dst")
m.store(uid, "+FLAGS", "\\Deleted")
m.expunge()
m.logout()
PY
}

mailbox_count() {
  local user="$1" mailbox="$2"
  docker exec mail-dovecot doveadm fetch -u "${user}@${TEST_DOMAIN}" uid mailbox "$mailbox" all 2>/dev/null | grep -c '^uid:'
}

mailbox_has_subject() {
  local user="$1" mailbox="$2" subject="$3"
  docker exec mail-dovecot doveadm fetch -u "${user}@${TEST_DOMAIN}" "hdr.subject" mailbox "$mailbox" all 2>/dev/null | grep -q "$subject"
}

redis_get() {
  docker exec mail-redis redis-cli "$@" 2>/dev/null
}

sieve_script() {
  local user="$1"
  docker exec mail-dovecot cat "/var/mail/vhosts/${TEST_DOMAIN}/${user}/sieve/roundcube.sieve" 2>/dev/null
}

# Wait for a command (a shell-callable function or external cmd) to return
# 0 within the timeout, with a 1-second backoff.
wait_for() {
  local timeout="$1"; shift
  local deadline=$((SECONDS+timeout))
  while [[ $SECONDS -lt $deadline ]]; do
    "$@" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}
