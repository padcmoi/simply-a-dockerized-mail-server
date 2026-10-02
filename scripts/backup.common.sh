# Shared by scripts/backup.install.sh, scripts/backup.apply.sh and
# scripts/backup.sh. Sourced, never run.

PROJECT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CONF_FILE="${BACKUP_CONF:-$PROJECT_DIR/backup.conf}"
CRON_FILE="${BACKUP_CRON_FILE:-/etc/cron.d/simply-mailserver-backup}"

DEFAULT_TIME="02:30"
DEFAULT_KEEP_DAYS=5
DEFAULT_DIR="./backup"
TIME_PATTERN='^([01][0-9]|2[0-3]):[0-5][0-9]$'
KEEP_DAYS_PATTERN='^[1-9][0-9]{0,2}$'
REMOTE_PATTERN='^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:/[A-Za-z0-9._/-]*$'
ARCHIVE_PATTERN='^backup-([0-9]{4}-[0-9]{2}-[0-9]{2})\.tar\.gz$'
SSH_OPTIONS=(-o BatchMode=yes -o ConnectTimeout=20)

die() {
	echo "ERROR: $*" >&2
	exit 2
}

need_root() {
	[ "$(id -u)" = "0" ] || die "run me as root: sudo ${BACKUP_ENTRYPOINT:-$0}"
}

file_get() {
	[ -f "$1" ] || return 0
	grep -E "^$2=" "$1" | tail -1 | cut -d= -f2-
}

conf_get() {
	file_get "$CONF_FILE" "$1"
}

conf_or() {
	local value
	value=$(conf_get "$1")
	printf "%s" "${value:-$2}"
}

env_get() {
	grep -E "^$1=" "$PROJECT_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

volumes_dir() {
	local raw candidate
	raw=$(env_get VOLUMES_PATH)
	[ -n "$raw" ] || return 1
	case "$raw" in
	/*) candidate="$raw" ;;
	*)
		for candidate in "$PROJECT_DIR/docker/services/$raw" "$PROJECT_DIR/$raw"; do
			[ -d "$candidate/mysql" ] && break
		done
		;;
	esac
	[ -d "$candidate/mysql" ] || return 1
	(cd "$candidate" && pwd)
}

resolve_dir() {
	case "$1" in
	/*) printf "%s" "$1" ;;
	*) printf "%s/%s" "$PROJECT_DIR" "${1#./}" ;;
	esac
}

is_remote() {
	[[ "$1" =~ $REMOTE_PATTERN ]]
}

lock_file() {
	local dir=/tmp
	[ -d /run/lock ] && [ -w /run/lock ] && dir=/run/lock
	printf "%s/simply-mailserver-%s-%s.lock" "$dir" "$1" "$(printf "%s" "$PROJECT_DIR" | cksum | cut -d' ' -f1)"
}

managed_dir() {
	if [ -n "${BACKUP_MANAGED_DIR:-}" ]; then
		printf "%s" "$BACKUP_MANAGED_DIR"
		return 0
	fi
	local volumes
	volumes=$(volumes_dir) || return 1
	printf "%s/backup-managed" "$volumes"
}

host_timezone() {
	local zone=""
	[ -r /etc/timezone ] && zone=$(tr -d '[:space:]' </etc/timezone)
	[ -n "$zone" ] || zone=$(timedatectl show -p Timezone --value 2>/dev/null || true)
	printf "%s" "${zone:-UTC}"
}

write_conf() {
	cat >"$CONF_FILE.tmp" <<EOF
# Configuration of scripts/backup.sh. Written by scripts/backup.install.sh, and
# by scripts/backup.apply.sh when it is changed from the manager.
BACKUP_TIME=$1
BACKUP_KEEP_DAYS=$2
BACKUP_DIR=$3
BACKUP_OFFSITE=$4
BACKUP_OFFSITE_DELETE_LOCAL=$5
EOF
	chmod 644 "$CONF_FILE.tmp" && mv "$CONF_FILE.tmp" "$CONF_FILE"
}

write_cron() {
	local time="$1" hour minute
	hour=$((10#${time%%:*}))
	minute=$((10#${time##*:}))
	cat >"$CRON_FILE.tmp" <<EOF
# Cold backup of the mail server in $PROJECT_DIR.
# Written by scripts/backup.install.sh, which also updates or removes it.
# The time is the one of this server's clock ($(host_timezone)): the manager shows
# it to each person in their own time. The second line applies, within a
# minute, a change of configuration asked from the manager.
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

$minute $hour * * * root cd "$PROJECT_DIR" && scripts/backup.sh >/dev/null 2>&1
* * * * * root cd "$PROJECT_DIR" && scripts/backup.apply.sh >/dev/null 2>&1
EOF
	chown root:root "$CRON_FILE.tmp" && chmod 644 "$CRON_FILE.tmp" && mv "$CRON_FILE.tmp" "$CRON_FILE"
}

publish_config() {
	local managed
	managed=$(managed_dir) || return 0
	mkdir -p "$managed" || return 0
	{
		grep -E '^BACKUP_[A-Z_]+=' "$CONF_FILE"
		echo "TIMEZONE=$(host_timezone)"
		echo "PUBLISHED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	} >"$managed/.config.conf.tmp" && chmod 644 "$managed/.config.conf.tmp" && mv "$managed/.config.conf.tmp" "$managed/config.conf"
}

unpublish_config() {
	local managed
	managed=$(managed_dir) || return 0
	rm -f "$managed/config.conf" "$managed/request.conf" "$managed/status.conf" "$managed/retrieve.conf" "$managed/retrieve-status.conf"
}
