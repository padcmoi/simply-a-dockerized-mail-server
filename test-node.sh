#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
EXIT_CODE=0

pkg_manager() {
	local dir="$1"
	if [ -f "$dir/pnpm-lock.yaml" ]; then
		echo "pnpm"
	elif [ -f "$dir/yarn.lock" ]; then
		echo "yarn"
	else
		echo "npm"
	fi
}

ensure_deps() {
	local dir="$1"
	local pm
	pm="$(pkg_manager "$dir")"
	if [ ! -d "$dir/node_modules" ]; then
		echo "==> installing dependencies in $dir"
		(cd "$dir" && "$pm" install)
	fi
}

run() {
	local label="$1" dir="$2" cmd="$3"
	local pm
	pm="$(pkg_manager "$dir")"
	echo "==> $label"
	(cd "$dir" && "$pm" run "$cmd") || {
		echo "[FAIL] $label"
		EXIT_CODE=1
	}
}

ensure_deps "$REPO_ROOT"
ensure_deps "$REPO_ROOT/manager-api"
ensure_deps "$REPO_ROOT/manager-ui"

run "manager-api: typecheck" "$REPO_ROOT/manager-api" "typecheck"
run "manager-api: lint" "$REPO_ROOT/manager-api" "lint"
run "manager-api: test" "$REPO_ROOT/manager-api" "test:cov"
run "manager-ui: typecheck" "$REPO_ROOT/manager-ui" "typecheck"
run "manager-ui: lint" "$REPO_ROOT/manager-ui" "lint"
run "manager-ui: test" "$REPO_ROOT/manager-ui" "test"

exit $EXIT_CODE
