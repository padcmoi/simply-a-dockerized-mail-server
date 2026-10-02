#!/usr/bin/env bash
# Does what the manager asks of this server. Started every minute by the cron
# entry scripts/backup.install.sh writes; it leaves at once when nothing is
# asked.
#
# The manager drops a request in the folder it shares with the host, and reads
# the answer there.
#
#   request.conf   a change of configuration. Every value is checked again
#                  here, then backup.conf and the cron entry are rewritten, and
#                  status.conf says what happened. The manager can change the
#                  time, the number of backups kept and the off-site
#                  destination: never the folder of the archives, and it can
#                  neither install nor remove the backup.
#
#   retrieve.conf  an archive that was sent off-site, to bring back into the
#                  folder of the archives so that it can be downloaded. Its
#                  name and the place it is kept are checked again here, it is
#                  copied with rsync over ssh and nothing else, it stays
#                  off-site too, and retrieve-status.conf says what happened.
#
# Usage: sudo scripts/backup.apply.sh
set -uo pipefail

# shellcheck source=scripts/backup.common.sh
. "$(dirname "$0")/backup.common.sh"
cd "$PROJECT_DIR"

REQUEST_ID_PATTERN='^[0-9a-f-]{36}$'
BYTES_PATTERN='^[0-9]{1,15}$'
MAX_REQUEST_BYTES=2048
SPACE_MARGIN_PERCENT=10

need_root
MANAGED=$(managed_dir) || exit 0

REQUEST=""
STATUS=""
REQUEST_ID=""
ARCHIVE=""

answer() {
	local state="$1" error="$2" tmp
	tmp="$MANAGED/.$(basename "$STATUS").tmp"
	{
		echo "REQUEST_ID=$REQUEST_ID"
		[ -z "$ARCHIVE" ] || echo "NAME=$ARCHIVE"
		echo "STATE=$state"
		echo "ERROR=$error"
		echo "AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	} >"$tmp" && chmod 644 "$tmp" && mv "$tmp" "$STATUS"
	rm -f "$REQUEST"
	[ "$state" = "error" ] && exit 1
	exit 0
}

open_request() {
	if [ -L "$REQUEST" ] || [ "$(stat -c %s "$REQUEST")" -gt "$MAX_REQUEST_BYTES" ]; then
		answer error "the request is not a small plain file"
	fi
	REQUEST_ID=$(file_get "$REQUEST" REQUEST_ID)
	[[ "$REQUEST_ID" =~ $REQUEST_ID_PATTERN ]] || REQUEST_ID=""
}

apply_config() {
	local time keep offsite delete_local
	REQUEST="$MANAGED/request.conf"
	STATUS="$MANAGED/status.conf"
	[ -f "$REQUEST" ] || return 0
	exec 8>"$(lock_file backup-apply)"
	flock -n 8 || return 0

	open_request
	time=$(file_get "$REQUEST" BACKUP_TIME)
	keep=$(file_get "$REQUEST" BACKUP_KEEP_DAYS)
	offsite=$(file_get "$REQUEST" BACKUP_OFFSITE)
	delete_local=$(file_get "$REQUEST" BACKUP_OFFSITE_DELETE_LOCAL)

	[ -f "$CONF_FILE" ] && [ -f "$CRON_FILE" ] || answer error "the backup is not installed on this server"
	[[ "$time" =~ $TIME_PATTERN ]] || answer error "the time is not HH:MM"
	[[ "$keep" =~ $KEEP_DAYS_PATTERN ]] || answer error "the number of backups kept is not between 1 and 999"
	[ -z "$offsite" ] || is_remote "$offsite" || answer error "the off-site destination is not user@host:/path"
	[ "$delete_local" = "yes" ] || [ "$delete_local" = "no" ] || answer error "the delete choice is not yes or no"

	write_conf "$time" "$keep" "$(conf_or BACKUP_DIR "$DEFAULT_DIR")" "$offsite" "$delete_local" || answer error "backup.conf cannot be written"
	write_cron "$time" || answer error "the cron entry cannot be written"
	publish_config
	answer applied ""
}

retrieve_archive() {
	local name from bytes dir staging free
	REQUEST="$MANAGED/retrieve.conf"
	STATUS="$MANAGED/retrieve-status.conf"
	[ -f "$REQUEST" ] || return 0
	exec 7>"$(lock_file backup-retrieve)"
	flock -n 7 || return 0

	open_request
	name=$(file_get "$REQUEST" NAME)
	from=$(file_get "$REQUEST" FROM)
	bytes=$(file_get "$REQUEST" BYTES)
	[[ "$name" =~ $ARCHIVE_PATTERN ]] || answer error "the name is not the one of an archive"
	ARCHIVE="$name"
	is_remote "$from" || answer error "the place of the archive is not user@host:/path"
	[[ "$bytes" =~ $BYTES_PATTERN ]] || bytes=0
	[ -f "$CONF_FILE" ] || answer error "the backup is not installed on this server"

	dir=$(resolve_dir "$(conf_or BACKUP_DIR "$DEFAULT_DIR")")
	mkdir -p "$dir" && chmod 700 "$dir" || answer error "the folder of the archives cannot be created"
	[ -f "$dir/$name" ] && answer done ""
	command -v rsync >/dev/null 2>&1 || answer error "rsync is not installed on this server"
	free=$(df -PB1 "$dir" | awk 'NR==2 {print $4}')
	[ "$free" -gt $((bytes + bytes * SPACE_MARGIN_PERCENT / 100)) ] || answer error "not enough disk space to bring the archive back"

	staging="$dir/.retrieve"
	trap 'rm -rf "$staging"' EXIT
	rm -rf "$staging"
	mkdir -p "$staging" && chmod 700 "$staging" || answer error "the folder of the archives cannot be written"
	rsync -a -e "ssh ${SSH_OPTIONS[*]}" "$from/$name" "$staging/" </dev/null 2>/dev/null || answer error "the archive could not be brought back from $from"
	chown root:root "$staging/$name" && chmod 600 "$staging/$name" && mv -n "$staging/$name" "$dir/$name" || answer error "the archive could not be put in the folder of the archives"
	answer done ""
}

(apply_config)
(retrieve_archive)
exit 0
