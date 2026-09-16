#!/bin/sh
set -eu
export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

ACTION="$1"
USER="$2"
FROM="$3"

[ -n "$FROM" ] || exit 0
[ "$ACTION" = "spam" ] || exit 0

COUNT_KEY="spam_count:${USER}:${FROM}"
COUNT="$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" GET "$COUNT_KEY" 2>/dev/null || echo 0)"
[ "${COUNT:-0}" -eq "$BLOCKLIST_THRESHOLD" ] || exit 0

USER_DOMAIN="${USER#*@}"
POSTMASTER="postmaster@${USER_DOMAIN}"
date_hdr="$(date -R 2>/dev/null || date)"
mid="<blocklist-notice.$$.$(date +%s 2>/dev/null || echo 0)@${USER_DOMAIN}>"
APP_VERSION="$(head -n 1 /host/manager-api/VERSION 2>/dev/null | tr -d '[:space:]' || true)"
MAILER="Simply Mail Server ${APP_VERSION:-unknown}"

NOTICE="$(mktemp)"
trap 'rm -f "$NOTICE"' EXIT

cat >"$NOTICE" <<EOF
From: ${POSTMASTER}
To: ${USER}
Date: ${date_hdr}
Subject: Sender ${FROM} is now auto-routed to Junk
Message-ID: ${mid}
X-Mailer: ${MAILER}
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

Hello,

You have flagged messages from ${FROM} as spam ${BLOCKLIST_THRESHOLD}
times. From now on, every new message from this sender will be delivered
straight to your Junk folder.

Important: no message is ever rejected. You can still open the Junk folder
and read anything that lands there. Deleting messages from Junk (or
emptying the Trash) does NOT undo the block.

If you change your mind and want to receive ${FROM} in your Inbox again,
do this: open your Junk folder, pick any message from ${FROM}, and move
it to your Inbox (Boite de reception). That single move clears the block
immediately, and the next message from ${FROM} will land in your Inbox.

postmaster
EOF

if /usr/libexec/dovecot/dovecot-lda -d "$USER" -f "$POSTMASTER" <"$NOTICE" 2>/dev/null; then
	exit 0
fi

if doveadm save -u "$USER" -m INBOX <"$NOTICE" 2>/dev/null; then
	exit 0
fi

echo "40-notify: blocklist notice NOT delivered to $USER (sender $FROM)" >&2
exit 0
