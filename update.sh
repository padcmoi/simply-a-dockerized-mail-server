#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE=(docker compose -f docker-compose.roundcube.yml)

usage() {
	echo "Usage: $0 full | ui | api | ui api" >&2
	exit 1
}

[ "$#" -gt 0 ] || usage

FULL=0
SERVICES=()

for arg in "$@"; do
	case "$arg" in
	full) FULL=1 ;;
	ui) [[ " ${SERVICES[*]-} " == *" manager-ui "* ]] || SERVICES+=(manager-ui) ;;
	api) [[ " ${SERVICES[*]-} " == *" manager-api "* ]] || SERVICES+=(manager-api) ;;
	*) usage ;;
	esac
done

[ "$FULL" -eq 0 ] || [ "$#" -eq 1 ] || usage

git pull

if [ "$FULL" -eq 1 ]; then
	"${COMPOSE[@]}" build
	"${COMPOSE[@]}" up -d
	exit 0
fi

"${COMPOSE[@]}" build "${SERVICES[@]}"
"${COMPOSE[@]}" up -d --no-deps "${SERVICES[@]}"
