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

# The directory this was launched from can have been deleted under the shell,
# which leaves it holding a handle on nothing. Node dies on process.cwd() with
# a stack trace that names none of this, so say it plainly when bash still can.
# Reached only when bash itself started: `pnpm db:*` dies before this file runs.
if ! pwd >/dev/null 2>&1; then
	echo "" >&2
	echo "[FAIL] the directory you are in no longer exists." >&2
	echo "       It was deleted while this shell was standing in it." >&2
	echo "       Come back with an absolute path (not 'cd .'):" >&2
	echo "         cd \"$(dirname "$0")\"" >&2
	echo "" >&2
	exit 1
fi

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

# Everything that can stand between here and the database, each said in one
# line. None of it is repaired: this script reports, the operator decides.
die() {
	echo "" >&2
	echo "[FAIL] $1" >&2
	shift
	for line in "$@"; do echo "       $line" >&2; done
	echo "" >&2
	exit 1
}

if ! command -v docker >/dev/null 2>&1; then
	die "docker is not installed on this machine." "The TypeORM CLI only reaches the database from inside $CONTAINER."
fi

if ! docker info >/dev/null 2>&1; then
	die "the docker daemon is not answering." "Start docker, then bring the stack up with ./service.sh up"
fi

# Kept out of a `||` fallback on purpose: a failing `docker inspect` still
# writes an empty line to stdout, which would land in front of the fallback and
# print as a two-line state.
state="$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null)" || state=""
[ -n "$state" ] || state="absent"
case "$state" in
running) ;;
absent)
	die "the container $CONTAINER does not exist." \
		"The stack has never been brought up here, or it was removed." \
		"Bring it up with:  ./service.sh up"
	;;
*)
	die "the container $CONTAINER is down (state: $state)." \
		"It has to be running: the database only answers on the docker network." \
		"Start it with:  ./service.sh up"
	;;
esac

# One quoted string for `sh -c`, so an argument carrying a space survives.
quoted=""
for arg in "${args[@]}"; do
	quoted="$quoted $(printf '%q' "$arg")"
done

exec docker exec -e TS_NODE_TRANSPILE_ONLY=true "$CONTAINER" sh -c "cd /app && pnpm typeorm$quoted"
