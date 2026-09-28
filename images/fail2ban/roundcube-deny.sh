#!/bin/sh
set -eu

DIR="/var/lib/fail2ban/roundcube-deny"
LOCK="/var/run/fail2ban/roundcube-deny.lock"

usage() {
	echo "usage: $0 start|stop <jail> | ban|unban <jail> <ip>" >&2
	exit 2
}

[ $# -ge 2 ] || usage
action="$1"
case "$2" in
*[!A-Za-z0-9_-]* | "") usage ;;
esac
FILE="${DIR}/$2.deny"

valid() {
	case "$1" in
	"" | *[!0-9A-Fa-f.:]*) return 1 ;;
	esac
	return 0
}

rewrite() {
	tmp="${FILE}.tmp.$$"
	"$@" >"$tmp"
	chmod 0644 "$tmp"
	mv -f "$tmp" "$FILE"
}

keep_others() {
	grep -vxF -- "$1" "$FILE" 2>/dev/null || true
}

add_one() {
	keep_others "$1"
	echo "$1"
}

mkdir -p "$DIR" "$(dirname "$LOCK")"
exec 9>"$LOCK"
flock 9

case "$action" in
start)
	rewrite true
	;;
stop)
	rm -f "$FILE"
	;;
ban)
	[ $# -eq 3 ] || usage
	valid "$3" || exit 0
	rewrite add_one "$3"
	;;
unban)
	[ $# -eq 3 ] || usage
	valid "$3" || exit 0
	rewrite keep_others "$3"
	;;
*) usage ;;
esac
