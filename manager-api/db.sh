#!/usr/bin/env bash
set -euo pipefail

# The TypeORM CLI, run where it can actually reach the database.
#
# It has to run inside the manager-api container: DB_HOST is `mail-mariadb`, a
# name that only resolves on the Docker network, and the DB_* credentials are
# injected there by compose. Run from the host it fails on the connection, so
# every db:* script of package.json comes through here rather than leaving the
# right incantation to be remembered.
#
# TS_NODE_TRANSPILE_ONLY is not a shortcut: ts-node type-checks data-source.ts
# against the CLI's own tsconfig, which carries no node types, and stops on
# `Cannot find name 'process'` before ever opening a connection.
#
# This never starts anything. A stopped container is reported, not booted: the
# stack is heavy and bringing it up is a deliberate act, not a side effect of
# asking for a migration.

CONTAINER="${MANAGER_API_CONTAINER:-mail-manager-api}"
DATA_SOURCE="src/core/database/data-source.ts"
MIGRATIONS_DIR="src/core/database/migrations"

if [ "$#" -eq 0 ]; then
	echo "usage: ./db.sh <typeorm migration subcommand> [name] [flags...]" >&2
	echo "  ./db.sh migration:show" >&2
	echo "  ./db.sh migration:generate AddSomething   -> $MIGRATIONS_DIR/<epoch ms>-AddSomething.ts" >&2
	exit 1
fi

command="$1"
shift

# `migration:create` only writes an empty file: it takes a path and no data
# source, and passing -d makes it fail on an unknown argument.
if [ "$command" = "migration:create" ]; then
	args=("$command")
else
	args=("$command" -d "$DATA_SOURCE")
fi

# Both generating and creating take a path whose basename becomes the migration
# name, TypeORM prefixing it with the epoch in milliseconds. A bare name is
# expanded to the migrations directory, so one writes `AddSomething` and not the
# whole path; a value that already looks like a path is left alone, and only the
# first positional is touched so a flag never gets rewritten.
case "$command" in
migration:generate | migration:create) takes_a_name=1 ;;
*) takes_a_name=0 ;;
esac

expanded=0
for arg in "$@"; do
	if [ "$takes_a_name" -eq 1 ] && [ "$expanded" -eq 0 ]; then
		case "$arg" in
		-*) ;;
		*/*) expanded=1 ;;
		*)
			arg="$MIGRATIONS_DIR/$arg"
			expanded=1
			;;
		esac
	fi
	args+=("$arg")
done

# Already inside the container (someone opened a shell in it): run in place,
# there is no docker client in there to exec with.
if [ -f /.dockerenv ]; then
	TS_NODE_TRANSPILE_ONLY=true exec pnpm typeorm "${args[@]}"
fi

if ! command -v docker >/dev/null 2>&1; then
	echo "[FAIL] docker is not available, and this is not running inside $CONTAINER" >&2
	exit 1
fi

running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo "missing")"
if [ "$running" != "true" ]; then
	echo "[FAIL] container $CONTAINER is not running - start the stack first, this script will not do it for you" >&2
	exit 1
fi

# One quoted string for `sh -c`, so an argument carrying a space survives.
quoted=""
for arg in "${args[@]}"; do
	quoted="$quoted $(printf '%q' "$arg")"
done

exec docker exec -e TS_NODE_TRANSPILE_ONLY=true "$CONTAINER" sh -c "cd /app && pnpm typeorm$quoted"
