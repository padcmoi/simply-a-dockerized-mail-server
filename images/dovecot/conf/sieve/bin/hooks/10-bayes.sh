#!/bin/sh
# Train rspamd's bayes classifier per recipient. The controller IP is in
# rspamd's secure_ip, so no password is required.
set -eu
export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

ACTION="$1"
USER="$2"
# FROM not needed for bayes; we keep the slot to share a stable interface.
MESSAGE_FILE="$4"

case "$ACTION" in
  spam) cmd="learn_spam" ;;
  ham)  cmd="learn_ham"  ;;
  *) exit 0 ;;
esac

rspamc -h "${RSPAMD_HOST}:${RSPAMD_PORT}" -d "$USER" "$cmd" < "$MESSAGE_FILE" >&2 || true
exit 0
