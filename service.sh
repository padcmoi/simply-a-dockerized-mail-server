#!/usr/bin/env bash
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PROFILES_FILE="${ROOT}/.profiles"
KNOWN_PROFILES=(clamav opendmarc)

read_profiles() {
  [[ -f "$PROFILES_FILE" ]] || return 0
  grep -vE '^[[:space:]]*(#|$)' "$PROFILES_FILE" || true
}

profile_flags() {
  local p
  while IFS= read -r p; do
    [[ -z "$p" ]] && continue
    printf '%s\n%s\n' "--profile" "$p"
  done < <(read_profiles)
}

dc() {
  local flags=()
  mapfile -t flags < <(profile_flags)
  if [[ ${#flags[@]} -eq 0 ]]; then
    docker compose "$@"
  else
    docker compose "${flags[@]}" "$@"
  fi
}

is_known() {
  local p=$1 k
  for k in "${KNOWN_PROFILES[@]}"; do [[ $p == "$k" ]] && return 0; done
  return 1
}

cmd_enable() {
  local p=$1
  is_known "$p" || { echo "unknown profile: $p (known: ${KNOWN_PROFILES[*]})" >&2; exit 1; }
  touch "$PROFILES_FILE"
  grep -qxF "$p" "$PROFILES_FILE" || echo "$p" >> "$PROFILES_FILE"
  echo "enabled: $p"
}

cmd_disable() {
  local p=$1
  is_known "$p" || { echo "unknown profile: $p (known: ${KNOWN_PROFILES[*]})" >&2; exit 1; }
  [[ -f "$PROFILES_FILE" ]] || return 0
  grep -vxF "$p" "$PROFILES_FILE" > "${PROFILES_FILE}.tmp"
  mv "${PROFILES_FILE}.tmp" "$PROFILES_FILE"
  echo "disabled: $p"
}

cmd_list() {
  local enabled
  enabled=$(read_profiles | tr '\n' ' ' | sed 's/ $//')
  echo "Known profiles : ${KNOWN_PROFILES[*]}"
  echo "Enabled        : ${enabled:-<none>}"
}

usage() {
  cat <<EOF
Usage: ./service.sh <command> [args...]

Lifecycle
  up [svc...]        compose up -d (applies enabled profiles)
  down               compose down
  restart [svc...]   down then up
  rebuild [svc...]   build --no-cache then up
  pull               compose pull

Inspection
  ps                 compose ps
  logs [svc...]      compose logs -f --tail=200
  exec <svc> [cmd]   compose exec <svc> (default: sh)
  shell <svc>        alias of: exec <svc> sh

Profiles
  list               show known + enabled profiles
  enable <profile>   persist profile in .profiles
  disable <profile>  remove profile from .profiles

Anything else is forwarded verbatim to: docker compose <profile-flags> <args>

Known profiles: ${KNOWN_PROFILES[*]}
EOF
}

main() {
  local cmd=${1:-}
  [[ $# -gt 0 ]] && shift
  case "$cmd" in
    up)               dc up -d "$@" ;;
    down)             dc down "$@" ;;
    restart)          dc down "$@"; dc up -d "$@" ;;
    rebuild)          dc build --no-cache "$@"; dc up -d "$@" ;;
    pull)             dc pull "$@" ;;
    ps|status)        dc ps "$@" ;;
    logs)             dc logs -f --tail=200 "$@" ;;
    exec)
      local svc=${1:?service required}
      shift
      if [[ $# -eq 0 ]]; then dc exec "$svc" sh; else dc exec "$svc" "$@"; fi
      ;;
    shell)            dc exec "${1:?service required}" sh ;;
    list|profiles)    cmd_list ;;
    enable)           cmd_enable "${1:?profile required}" ;;
    disable)          cmd_disable "${1:?profile required}" ;;
    ""|-h|--help|help) usage ;;
    *)                dc "$cmd" "$@" ;;
  esac
}

main "$@"
