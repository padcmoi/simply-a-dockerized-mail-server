#!/bin/sh
set -eu
export PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

USER="${1:?recipient required}"
FROM="${2:?sender required}"
DEST="${3:?destination required}"

USER_DOMAIN="${USER#*@}"
POSTMASTER="postmaster@${USER_DOMAIN}"

date_hdr="$(date -R 2>/dev/null || date)"
mid="<autoroute-notice.$$.$(date +%s 2>/dev/null || echo 0)@${USER_DOMAIN}>"
APP_VERSION="$(head -n 1 /host/manager-api/VERSION 2>/dev/null | tr -d '[:space:]' || true)"
MAILER="Simply Mail Server ${APP_VERSION:-unknown}"

NOTICE="$(mktemp)"
trap 'rm -f "$NOTICE"' EXIT

cat >"$NOTICE" <<EOF
From: ${POSTMASTER}
To: ${USER}
Date: ${date_hdr}
Subject: Sender ${FROM} is now auto-routed to ${DEST}
Message-ID: ${mid}
X-Mailer: ${MAILER}
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

Hello,

You have just moved a message from ${FROM} into your ${DEST} folder.
From now on, every new message from this sender is delivered straight
to ${DEST}, without passing through your Inbox.

The rule is visible in your webmail under Settings > Filters, named
"AUTOROUTER ${DEST} ${FROM}". You can edit it or delete it there like
any other filter.

If you want ${FROM} back in your Inbox, move any message from this
sender from ${DEST} to your Inbox (Boite de reception). That single
move deletes the rule, and the next message from ${FROM} lands in your
Inbox again.

postmaster
EOF

if /usr/libexec/dovecot/dovecot-lda -d "$USER" -f "$POSTMASTER" <"$NOTICE" 2>/dev/null; then
	exit 0
fi

if doveadm save -u "$USER" -m INBOX <"$NOTICE" 2>/dev/null; then
	exit 0
fi

echo "20-notify: autoroute notice NOT delivered to $USER (sender $FROM, folder $DEST)" >&2
exit 0
