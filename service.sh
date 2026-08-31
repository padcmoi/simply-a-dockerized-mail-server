#!/usr/bin/env bash
# Wrapper around docker compose for the mail stack.
#   up           build + start
#   up:noav      start without antivirus profile
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

# The project's last git tag, written where the manager-api image can bake it in.
# The containers carry no git and no repository, so it is captured here, once,
# before anything is built. Served by GET /api/v1 as code_version.
git describe --tags --abbrev=0 > manager-api/VERSION 2>/dev/null || echo unknown > manager-api/VERSION

CMD="${1:-help}"
shift || true

case "$CMD" in
up) docker compose --profile antivirus up -d --build ;;
up:noav) docker compose up -d --build ;;
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
