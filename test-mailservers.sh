#!/usr/bin/env bash
# Orchestrator for the mail-server end-to-end test suite. The actual
# checks live in `tests/[0-9]*.sh`, grouped by business concern (infra /
# auth / delivery / sieve / autorouter / blocklist / hooks / antivirus /
# postfix limits / roundcube / hygiene). This file owns the lifecycle:
# bootstrap the env, bring the stack up, seed the recipients, source the
# test files in numerical order, tear the fixtures down, and write the
# markdown report.
#
# Out of scope on purpose: manager-api and manager-ui. Those are covered
# by their own vitest suite.
#
# Usage:  ./test-mailservers.sh
# Exits 0 if every check passes, 1 if any check failed.

set -u +e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

SCRATCH_DIR="$(mktemp -d -t mailtest.XXXXXX)"
trap 'rm -rf "$SCRATCH_DIR"' EXIT

# ---------- shared helpers + recipient fixtures ----------
# shellcheck source=tests/_lib.sh
source "$PROJECT_DIR/tests/_lib.sh"
# shellcheck source=tests/_fixtures.sh
source "$PROJECT_DIR/tests/_fixtures.sh"

# ---------- stack lifecycle ----------
stack_up() {
  section "Stack startup"
  if docker compose ps --status running 2>/dev/null | grep -q mail-dovecot; then
    log "Stack already running"
  else
    log "Bringing the stack up via docker compose"
    docker compose up -d --build >>"$LOG_FILE" 2>&1 || {
      echo "FATAL: docker compose up failed - see $LOG_FILE" >&2
      exit 2
    }
  fi
  log "Waiting up to 180s for healthchecks to report healthy"
  local deadline=$((SECONDS+180))
  while [[ $SECONDS -lt $deadline ]]; do
    local all=1
    for c in "${HEALTH_CONTAINERS[@]}"; do
      local s; s=$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo unknown)
      [[ "$s" == "healthy" ]] || { all=0; break; }
    done
    [[ $all -eq 1 ]] && { log "All healthchecks green"; return 0; }
    sleep 5
  done
  log "Timeout waiting for healthy containers"
  return 1
}

# ---------- main ----------
# Reclaim log file if a previous sudo/CI run left it root-owned.
if [[ -f "$LOG_FILE" ]] && ! [[ -w "$LOG_FILE" ]]; then
  sudo chown "$(id -u):$(id -g)" "$LOG_FILE" 2>/dev/null || sudo rm -f "$LOG_FILE"
fi
: > "$LOG_FILE"
log "Test suite starting; domain=$TEST_DOMAIN host=$TEST_HOST"

stack_up || { echo "Stack failed to start; see $LOG_FILE"; exit 2; }
create_recipients

# Source every tests/[0-9]*.sh file in numerical order. Each file is
# self-contained: it defines its t_* functions and calls them at the end
# so sourcing == running.
for f in "$PROJECT_DIR"/tests/[0-9]*.sh; do
  # shellcheck source=/dev/null
  source "$f"
done

cleanup_recipients

{
  echo "# Mail server test report"
  echo
  echo "- Run at: $(date -Is)"
  echo "- Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  echo "- Commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "- Domain under test: \`$TEST_DOMAIN\` (host: \`$TEST_HOST\`)"
  echo "- Synthetic recipients: \`${TEST_USERS[*]/%/@$TEST_DOMAIN}\` (cleaned up)"
  echo
  echo "## Summary"
  echo
  echo "| Status | Count |"
  echo "|--------|-------|"
  echo "| PASS   | $PASS |"
  echo "| FAIL   | $FAIL |"
  echo "| SKIP   | $SKIP |"
  echo "| Total  | $((PASS+FAIL+SKIP)) |"
  echo
  echo "## Details"
  echo
  for line in "${RESULTS[@]}"; do echo "$line"; done
  echo
  echo "## Logs"
  echo
  echo "Full execution log: \`./test.log\`"
} > "$REPORT_FILE"

log "Done. PASS=$PASS FAIL=$FAIL SKIP=$SKIP -- report: $REPORT_FILE"
exit $([[ $FAIL -eq 0 ]] && echo 0 || echo 1)
