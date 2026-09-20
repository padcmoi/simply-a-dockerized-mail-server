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

# The changelog is the one file at the root anyone writes by hand, and it is
# markdown, where prettier rewrites emphasis and bullets: it goes through the
# same pass as the code so a commit never carries two styles of it. It belongs
# to neither package, so it borrows the prettier one of them installed.
format_changelog() {
	local bin="$REPO_ROOT/manager-ui/node_modules/.bin/prettier"
	[ -x "$bin" ] || bin="$REPO_ROOT/manager-api/node_modules/.bin/prettier"
	[ -x "$bin" ] || {
		echo "==> format of CHANGELOG.md skipped, prettier is not installed"
		return 0
	}
	echo "==> format CHANGELOG.md"
	"$bin" --write "$REPO_ROOT/CHANGELOG.md" >/dev/null
}

format_changelog
