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
#   offsite-request.conf
#                  the manager wants to know which archives are on the
#                  off-site server. The destination is the one of backup.conf,
#                  never one the manager gives; it is listed over ssh and
#                  offsite.conf holds the names found there, or says that it
#                  could not be reached.
#
#   retrieve.conf  an archive that was sent off-site, to download from there.
#                  Its name and the place it is kept are checked again here,
#                  then it is read on the other server over ssh into the pipe
#                  retrieve.pipe, which the manager hands to the browser. It is
#                  never written on this server and it stays off-site.
#                  retrieve-status.conf says `ready` once the pipe is fed,
#                  then how the download ended.
#
# Usage: sudo scripts/backup.apply.sh
set -uo pipefail

# shellcheck source=scripts/backup.common.sh
. "$(dirname "$0")/backup.common.sh"
cd "$PROJECT_DIR"

REQUEST_ID_PATTERN='^[0-9a-f-]{36}$'
BYTES_PATTERN='^[1-9][0-9]{0,14}$'
MAX_REQUEST_BYTES=2048
READER_WAIT_SECONDS=120
STREAM_MAX_SECONDS=21600
STREAM_SSH_OPTIONS=(-o ServerAliveInterval=15 -o ServerAliveCountMax=4)

need_root
MANAGED=$(managed_dir) || exit 0

REQUEST=""
STATUS=""
REQUEST_ID=""
ARCHIVE=""
ARCHIVE_BYTES=""

say() {
	local state="$1" error="$2" tmp
	tmp="$MANAGED/.$(basename "$STATUS").tmp"
	{
		echo "REQUEST_ID=$REQUEST_ID"
		[ -z "$ARCHIVE" ] || echo "NAME=$ARCHIVE"
		[ -z "$ARCHIVE_BYTES" ] || echo "BYTES=$ARCHIVE_BYTES"
		echo "STATE=$state"
		echo "ERROR=$error"
		echo "AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	} >"$tmp" && chmod 644 "$tmp" && mv "$tmp" "$STATUS"
}

answer() {
	say "$1" "$2"
	rm -f "$REQUEST"
	[ "$1" = "error" ] && exit 1
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

list_offsite() {
	local request offsite host path names state files tmp
	request="$MANAGED/offsite-request.conf"
	[ -f "$request" ] || return 0
	exec 6>"$(lock_file backup-offsite)"
	flock -n 6 || return 0

	offsite=$(conf_get BACKUP_OFFSITE)
	state=none
	files=""
	if is_remote "$offsite"; then
		host="${offsite%%:*}"
		path="${offsite#*:}"
		if names=$(ssh "${SSH_OPTIONS[@]}" "$host" "ls -1 '$path'" </dev/null 2>/dev/null); then
			state=listed
			files=$(printf '%s\n' "$names" | grep -E "$ARCHIVE_PATTERN" | paste -sd, -)
		else
			state=error
		fi
	else
		offsite=""
	fi
	tmp="$MANAGED/.offsite.conf.tmp"
	{
		echo "TARGET=$offsite"
		echo "STATE=$state"
		echo "FILES=$files"
		echo "AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	} >"$tmp" && chmod 644 "$tmp" && mv "$tmp" "$MANAGED/offsite.conf"
	rm -f "$request"
}

close_pipe() {
	[ -p "$PIPE" ] && exec 9<>"$PIPE"
	rm -f "$PIPE" "$TAKEN"
	exec 9>&-
}

retrieve_archive() {
	local name from host path feeder waited status
	REQUEST="$MANAGED/retrieve.conf"
	STATUS="$MANAGED/retrieve-status.conf"
	PIPE="$MANAGED/retrieve.pipe"
	TAKEN="$MANAGED/.retrieve.taken"
	exec 7>"$(lock_file backup-retrieve)"
	flock -n 7 || return 0

	if [ "$(file_get "$STATUS" STATE)" = "ready" ]; then
		REQUEST_ID=$(file_get "$STATUS" REQUEST_ID)
		ARCHIVE=$(file_get "$STATUS" NAME)
		say error "the download was interrupted"
		REQUEST_ID=""
		ARCHIVE=""
	fi
	close_pipe
	[ -f "$REQUEST" ] || return 0

	open_request
	name=$(file_get "$REQUEST" NAME)
	from=$(file_get "$REQUEST" FROM)
	[[ "$name" =~ $ARCHIVE_PATTERN ]] || answer error "the name is not the one of an archive"
	ARCHIVE="$name"
	is_remote "$from" || answer error "the place of the archive is not user@host:/path"
	[ -f "$CONF_FILE" ] || answer error "the backup is not installed on this server"
	host="${from%%:*}"
	path="${from#*:}"

	ARCHIVE_BYTES=$(ssh "${SSH_OPTIONS[@]}" "$host" "wc -c <'$path/$name'" </dev/null 2>/dev/null | tr -d '[:space:]')
	if ! [[ "$ARCHIVE_BYTES" =~ $BYTES_PATTERN ]]; then
		ARCHIVE_BYTES=""
		answer error "the archive could not be read at $from"
	fi

	trap close_pipe EXIT
	mkfifo -m 600 "$PIPE" || answer error "the pipe of the download cannot be made"
	say ready ""
	rm -f "$REQUEST"

	(
		exec 3>"$PIPE" || exit 1
		: >"$TAKEN"
		exec timeout "$STREAM_MAX_SECONDS" ssh "${SSH_OPTIONS[@]}" "${STREAM_SSH_OPTIONS[@]}" "$host" "cat -- '$path/$name'" </dev/null >&3 2>/dev/null
	) &
	feeder=$!
	waited=0
	while [ ! -e "$TAKEN" ] && kill -0 "$feeder" 2>/dev/null; do
		if [ "$waited" -ge "$READER_WAIT_SECONDS" ]; then
			kill "$feeder" 2>/dev/null
			break
		fi
		sleep 1
		waited=$((waited + 1))
	done
	wait "$feeder"
	status=$?

	[ -e "$TAKEN" ] || answer error "nobody came to download the archive within $READER_WAIT_SECONDS seconds"
	[ "$status" -eq 0 ] || answer error "the download from $from stopped before its end"
	answer done ""
}

(apply_config)
(list_offsite)
(retrieve_archive)
exit 0
