#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

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

run_format() {
	local dir="$1"
	local pm
	pm="$(pkg_manager "$dir")"
	echo "==> format in $dir"
	(cd "$dir" && "$pm" run format)
}

run_format "$REPO_ROOT/manager-api"
run_format "$REPO_ROOT/manager-ui"
