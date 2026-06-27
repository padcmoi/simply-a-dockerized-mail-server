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

CMD="${1:-help}"
shift || true

case "$CMD" in
  up)        docker compose --profile antivirus up -d --build ;;
  up:noav)   docker compose up -d --build ;;
  down)     docker compose --profile antivirus down ;;
  restart)  docker compose --profile antivirus restart ;;
  logs)     docker compose --profile antivirus logs -f "$@" ;;
  ps)       docker compose --profile antivirus ps ;;
  build)    docker compose --profile antivirus build "$@" ;;
  exec)
    SVC="${1:?service name required}"; shift
    docker compose --profile antivirus exec "$SVC" "${@:-sh}" ;;
  install)  ./install.sh ;;
  help|*)
    sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
