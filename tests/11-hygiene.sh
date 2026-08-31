#!/usr/bin/env bash
# Lightweight repo hygiene: the CHANGELOG must mention the AUTOROUTER
# feature so a release picks it up.

t_changelog_in_sync() {
  section "Repo hygiene"
  if grep -q "AUTOROUTER" "$PROJECT_DIR/CHANGELOG.md"; then
    pass "changelog.has_autorouter_entry" "found"
  else
    fail "changelog.has_autorouter_entry" "missing"
  fi
}

t_changelog_in_sync
