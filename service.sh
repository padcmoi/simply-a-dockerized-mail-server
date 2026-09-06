#!/usr/bin/env bash
# Wrapper around docker compose for the mail stack.
#   up           build + start
#   up:noav      start without antivirus profile
#   up:dev       build + start the dev stack (docker-compose.dev.yml)
#   down         stop and remove containers (keep volumes)
#   restart      restart all services
#   logs [svc]   follow logs (all or a single service)
#   ps           show containers
#   build        rebuild custom images
#   exec <svc>   open shell in service
#   install      run ./install.sh

set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
	echo "ERROR: .env missing - run ./install.sh first" >&2
	exit 1
fi

# The project's last git tag, written where the manager-api image can bake it in
# as its fallback. The container makes the version itself at every start, from
# the repository the compose file mounts, and writes this same file back.
# A directory of that name is what Docker leaves behind when a compose file once
# bind-mounted the file before it existed: cleared, or the write below fails.
[ -d manager-api/VERSION ] && rm -rf manager-api/VERSION
git describe --tags --abbrev=0 > manager-api/VERSION 2>/dev/null || echo unknown > manager-api/VERSION

CMD="${1:-help}"
shift || true

case "$CMD" in
up) docker compose --profile antivirus up -d --build ;;
up:noav) docker compose up -d --build ;;
up:dev) docker compose -f docker-compose.dev.yml --profile antivirus up -d --build ;;
down) docker compose --profile antivirus down ;;
restart) docker compose --profile antivirus restart ;;
logs) docker compose --profile antivirus logs -f "$@" ;;
ps) docker compose --profile antivirus ps ;;
build) docker compose --profile antivirus build "$@" ;;
exec)
	SVC="${1:?service name required}"
	shift
	docker compose --profile antivirus exec "$SVC" "${@:-sh}"
	;;
install) ./install.sh ;;
help | *)
	sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
	;;
esac
