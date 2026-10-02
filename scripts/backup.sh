#!/usr/bin/env bash
# One cold backup of the mail server: the volumes folder, .env and
# INSTALL_INFO.txt. Started every day by the cron entry that
# scripts/backup.install.sh writes, with the configuration it stores in
# backup.conf. Its activity diagram is in docs/operations/backup.md.
#
# Once a run has ended, the folder of the archives holds the archives and
# nothing else. The log and the result of the run go to the manager, which
# keeps them in its database; backup.log and the staging copy only exist while
# the run lasts. A report the manager did not take is the one thing left
# behind, in .reports/, until a later run delivers it.
#
# Usage: sudo scripts/backup.sh
set -uo pipefail

# shellcheck source=scripts/backup.common.sh
. "$(dirname "$0")/backup.common.sh"
cd "$PROJECT_DIR"

ALERT_SCRIPT="${BACKUP_ALERT_SCRIPT:-$PROJECT_DIR/scripts/send-alert.sh}"
REPORT_SENDER="${BACKUP_REPORT_SENDER:-}"
API_CONTAINER=mail-manager-api

STOP_TIMEOUT=60
UP_TIMEOUT=180
SPACE_MARGIN_PERCENT=10
REPORT_LOG_LINES=200
REPORTS_KEPT=50
REPORT_JS='
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk)).on("end", () => {
  fetch("http://127.0.0.1:" + (process.env.MANAGER_API_PORT || 3000) + "/api/v1/internal/backup/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: Buffer.concat(chunks),
  })
    .then((res) => process.exit(res.ok ? 0 : res.status >= 400 && res.status < 500 ? 3 : 1))
    .catch(() => process.exit(1));
});
'

STEP=check
RESULT=failed
ERROR=""
ARCHIVE_NAME=""
ARCHIVE_BYTES=0
STORED_IN=""
OUTAGE_SECONDS=0
STARTED_AT=0
FINISHED_AT=0
CONTAINERS=()
STOPPED=0
STAGING_DIR=""
BACKUP_DIR=""
LOG_FILE=""
REPORTS_DIR=""
OFFSITE_TARGET=""
OFFSITE_SENT=0
OFFSITE_REMOVED=()
RUN_LOG=()

log() {
	local line
	line="$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"
	echo "$line"
	RUN_LOG+=("$line")
	[ -n "$LOG_FILE" ] && echo "$line" >>"$LOG_FILE"
}

server_name() {
	local name
	name=$(env_get MAIL_HOSTNAME)
	printf "%s" "${name:-$(hostname -f 2>/dev/null || hostname)}"
}

alert() {
	local subject="[$(server_name)] Backup failed: $1" message="$2"
	"$ALERT_SCRIPT" "$subject" "$message" >/dev/null 2>&1
	case $? in
	0) log "alert sent: $1" ;;
	3) log "no alert address is set in the manager: no mail was sent" ;;
	*) log "the alert could not be sent" ;;
	esac
}

json_escape() {
	printf "%s" "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

containers_down() {
	local id name status health
	for id in "${CONTAINERS[@]}"; do
		read -r name status health < <(docker inspect -f '{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null)
		if [ "$status" != "running" ] || { [ "$health" != "none" ] && [ "$health" != "healthy" ]; }; then
			printf "%s " "${name#/}"
		fi
	done
}

wait_up() {
	local deadline=$(($(date +%s) + UP_TIMEOUT))
	while [ -n "$(containers_down)" ] && [ "$(date +%s)" -lt "$deadline" ]; do
		sleep 3
	done
	[ -z "$(containers_down)" ]
}

start_containers() {
	local id
	for id in "${CONTAINERS[@]}"; do
		docker start "$id" >/dev/null 2>&1
	done
}

stop_containers() {
	local id
	for id in "${CONTAINERS[@]}"; do
		docker stop -t "$STOP_TIMEOUT" "$id" >/dev/null 2>&1 &
	done
	wait
}

archives_project_dir() {
	local root relative
	root=$(cd "$PROJECT_DIR" && pwd -P)
	case "$BACKUP_DIR" in
	"$root"/*) relative="${BACKUP_DIR#"$root"/}" ;;
	*) return 0 ;;
	esac
	[[ "$relative" =~ ^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$ ]] && printf "%s" "$relative"
}

utc() {
	date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ
}

write_report() {
	local file="$1" line name separator="" first
	first=$((${#RUN_LOG[@]} > REPORT_LOG_LINES ? ${#RUN_LOG[@]} - REPORT_LOG_LINES : 0))
	{
		printf '{"run":{"startedAt":"%s","finishedAt":"%s","result":"%s","step":"%s","error":"%s",' \
			"$(utc "$STARTED_AT")" "$(utc "$FINISHED_AT")" "$RESULT" "$STEP" "$(json_escape "$ERROR")"
		printf '"durationSeconds":%d,"outageSeconds":%d,"archive":"%s","archiveBytes":%d,"storedIn":"%s",' \
			"$((FINISHED_AT - STARTED_AT))" "$OUTAGE_SECONDS" "$ARCHIVE_NAME" "$ARCHIVE_BYTES" "$(json_escape "$STORED_IN")"
		printf '"offsiteTarget":"%s","offsiteSent":%s,"log":[' "$(json_escape "$OFFSITE_TARGET")" "$([ "$OFFSITE_SENT" = 1 ] && echo true || echo false)"
		for line in "${RUN_LOG[@]:$first}"; do
			printf '%s"%s"' "$separator" "$(json_escape "$line")"
			separator=","
		done
		printf ']},"archivesDir":"%s","archivesProjectDir":"%s","localFiles":[' "$(json_escape "$BACKUP_DIR")" "$(archives_project_dir)"
		separator=""
		for name in "$BACKUP_DIR"/backup-*.tar.gz; do
			[ -f "$name" ] && [[ "$(basename "$name")" =~ $ARCHIVE_PATTERN ]] || continue
			printf '%s{"name":"%s","bytes":%d,"modifiedAt":"%s"}' "$separator" "$(basename "$name")" "$(stat -c %s "$name")" "$(utc "$(stat -c %Y "$name")")"
			separator=","
		done
		printf '],"offsiteDeleted":['
		separator=""
		for name in "${OFFSITE_REMOVED[@]}"; do
			printf '%s"%s"' "$separator" "$name"
			separator=","
		done
		printf ']}\n'
	} >"$file"
}

send_report() {
	if [ -n "$REPORT_SENDER" ]; then
		"$REPORT_SENDER" <"$1"
	else
		docker exec -i "$API_CONTAINER" node -e "$REPORT_JS" <"$1"
	fi >/dev/null 2>&1
}

send_reports() {
	local file
	for file in "$REPORTS_DIR"/*.json; do
		[ -f "$file" ] || continue
		send_report "$file"
		case $? in
		0) rm -f "$file" ;;
		3)
			echo "the manager refused the report $(basename "$file"): dropped"
			rm -f "$file"
			;;
		*)
			echo "the manager did not take the report $(basename "$file"): kept for the next run"
			break
			;;
		esac
	done
	find "$REPORTS_DIR" -maxdepth 1 -name "*.json" 2>/dev/null | sort | head -n -"$REPORTS_KEPT" | xargs -r rm -f
	rmdir "$REPORTS_DIR" 2>/dev/null
	return 0
}

keep_report() {
	mkdir -p "$REPORTS_DIR" && chmod 700 "$REPORTS_DIR" && write_report "$REPORTS_DIR/$STARTED_AT.json"
}

recover_interrupted() {
	local first
	[ -f "$LOG_FILE" ] || return 0
	(
		mapfile -t RUN_LOG <"$LOG_FILE"
		FINISHED_AT=$(stat -c %Y "$LOG_FILE")
		STARTED_AT=$FINISHED_AT
		first=$(head -1 "$LOG_FILE" | cut -c1-20)
		[[ "$first" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] && STARTED_AT=$(date -u -d "$first" +%s)
		RESULT=failed
		STEP=unknown
		ERROR="this run was interrupted before it could end"
		keep_report
	) && rm -f "$LOG_FILE"
}

close_run() {
	[ -n "$REPORTS_DIR" ] && [ -d "$BACKUP_DIR" ] || return 0
	FINISHED_AT=$(date +%s)
	keep_report && rm -f "$LOG_FILE"
	send_reports
}

on_exit() {
	if [ "$STOPPED" = 1 ]; then
		log "interrupted with the containers down: starting them again"
		start_containers
		STOPPED=0
	fi
	[ -n "$STAGING_DIR" ] && rm -rf "$STAGING_DIR"
	close_run
}

fail() {
	ERROR="$1"
	log "FAILED at step $STEP: $ERROR"
	exit 1
}

refuse() {
	ERROR="$1"
	log "FAILED at step $STEP, containers not stopped: $ERROR"
	alert "$1" "$2"
	exit 1
}

rotate_local() {
	local dir="$1" cutoff="$2" name
	for name in "$dir"/backup-*.tar.gz; do
		[ -f "$name" ] || continue
		[[ "$(basename "$name")" =~ $ARCHIVE_PATTERN ]] || continue
		if [[ ! "${BASH_REMATCH[1]}" > "$cutoff" ]]; then
			rm -f "$name"
			log "rotation: deleted $(basename "$name") from $dir"
		fi
	done
}

rotate_remote() {
	local host="$1" path="$2" cutoff="$3" name
	while IFS= read -r name; do
		[[ "$name" =~ $ARCHIVE_PATTERN ]] || continue
		if [[ ! "${BASH_REMATCH[1]}" > "$cutoff" ]]; then
			if ssh "${SSH_OPTIONS[@]}" "$host" "rm -f -- '$path/$name'" </dev/null; then
				OFFSITE_REMOVED+=("$name")
				log "rotation: deleted $name from $host:$path"
			fi
		fi
	done < <(ssh "${SSH_OPTIONS[@]}" "$host" "ls -1 '$path'" </dev/null 2>/dev/null)
}

run() {
	need_root
	[ -f "$CONF_FILE" ] || die "$CONF_FILE not found: the backup is not installed, run sudo ./backup.sh at the root of the project"

	local keep_days offsite delete_local volumes tool size free needed today archive down copy_status stop_at copy_at message cutoff
	BACKUP_DIR=$(conf_get BACKUP_DIR)
	[ -n "$BACKUP_DIR" ] && BACKUP_DIR=$(resolve_dir "$BACKUP_DIR")
	keep_days=$(conf_get BACKUP_KEEP_DAYS)
	offsite=$(conf_get BACKUP_OFFSITE)
	is_remote "$offsite" || offsite=""
	delete_local=$(conf_or BACKUP_OFFSITE_DELETE_LOCAL yes)
	[ -n "$BACKUP_DIR" ] || die "BACKUP_DIR is not set in $CONF_FILE"
	[[ "$keep_days" =~ $KEEP_DAYS_PATTERN ]] || keep_days=$DEFAULT_KEEP_DAYS

	mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR" || die "$BACKUP_DIR cannot be created"
	BACKUP_DIR=$(cd "$BACKUP_DIR" && pwd -P)
	exec 9>"$(lock_file backup)"
	if ! flock -n 9; then
		echo "another backup is running: nothing done"
		exit 0
	fi

	LOG_FILE="$BACKUP_DIR/backup.log"
	REPORTS_DIR="$BACKUP_DIR/.reports"
	recover_interrupted
	STARTED_AT=$(date +%s)
	today=$(date +%F)
	archive="backup-$today.tar.gz"
	trap on_exit EXIT
	trap 'exit 130' INT TERM
	log "backup started, archive $archive"

	for tool in rsync tar docker; do
		command -v "$tool" >/dev/null 2>&1 ||
			refuse "$tool is not installed" "The backup of $today did not run: $tool is not installed on the server. The service was not stopped."
	done

	volumes=$(volumes_dir) ||
		refuse "the volumes folder cannot be found" "The backup of $today did not run: the folder named by VOLUMES_PATH in .env cannot be found. The service was not stopped."
	[ -r "$PROJECT_DIR/.env" ] && [ -r "$PROJECT_DIR/INSTALL_INFO.txt" ] ||
		refuse ".env or INSTALL_INFO.txt is missing" "The backup of $today did not run: .env or INSTALL_INFO.txt is missing in $PROJECT_DIR. The service was not stopped."
	[[ "$BACKUP_DIR/" != "$volumes/"* ]] ||
		refuse "the archives folder is inside the volumes folder" "The backup of $today did not run: $BACKUP_DIR is inside the volumes folder it backs up. The service was not stopped."

	size=$(du -sbc "$volumes" "$PROJECT_DIR/.env" "$PROJECT_DIR/INSTALL_INFO.txt" 2>/dev/null | tail -1 | cut -f1)
	free=$(df -B1 --output=avail "$BACKUP_DIR" | tail -1 | tr -d ' ')
	needed=$((size * 2 * (100 + SPACE_MARGIN_PERCENT) / 100))
	log "to copy: $size bytes; needed for the copy and the archive: $needed bytes; free in $BACKUP_DIR: $free bytes"
	if [ "$free" -lt "$needed" ]; then
		message="The backup of $today did not run: not enough room on the disk holding $BACKUP_DIR.
Needed: $((needed / 1048576)) MB (the staging copy, the archive and a $SPACE_MARGIN_PERCENT % margin).
Free: $((free / 1048576)) MB.
The service was not stopped."
		refuse "not enough disk space" "$message"
	fi

	STEP=outage
	STAGING_DIR="$BACKUP_DIR/.staging"
	rm -rf "$STAGING_DIR"
	mkdir -p "$STAGING_DIR/volumes" && chmod 700 "$STAGING_DIR" || fail "the staging folder cannot be created"

	mapfile -t CONTAINERS < <(docker ps -q --no-trunc --filter "label=com.docker.compose.project.working_dir=$PROJECT_DIR" |
		xargs -r docker inspect -f '{{.State.StartedAt}} {{.Id}}' | sort | cut -d' ' -f2)
	log "stopping ${#CONTAINERS[@]} containers"
	stop_at=$(date +%s)
	STOPPED=1
	stop_containers
	log "containers stopped in $(($(date +%s) - stop_at)) seconds, copying"

	copy_at=$(date +%s)
	rsync -aHAX --delete "$volumes/" "$STAGING_DIR/volumes/" &&
		rsync -a "$PROJECT_DIR/.env" "$PROJECT_DIR/INSTALL_INFO.txt" "$STAGING_DIR/"
	copy_status=$?
	log "copy ended in $(($(date +%s) - copy_at)) seconds with status $copy_status, starting the containers"

	start_containers
	STOPPED=0
	if ! wait_up; then
		log "containers still down: $(containers_down); starting them once more"
		start_containers
		wait_up
	fi
	OUTAGE_SECONDS=$(($(date +%s) - stop_at))
	down=$(containers_down)
	if [ -n "$down" ]; then
		ERROR="containers still down after two starts: $down"
		log "FAILED at step $STEP: $ERROR"
		if [ "$(docker inspect -f '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = "true" ]; then
			alert "containers down" "After the backup copy of $today, these containers did not come back up: $down"
		else
			log "no mail possible: $API_CONTAINER, which sends the alert, is down"
		fi
		exit 1
	fi
	log "containers back up, outage of $OUTAGE_SECONDS seconds"
	if [ "$copy_status" -ne 0 ]; then
		ERROR="rsync failed with status $copy_status"
		log "FAILED at step $STEP: $ERROR"
		alert "the copy failed" "The backup of $today failed: rsync ended with status $copy_status. The service is back up. No archive was made."
		exit 1
	fi

	STEP=compress
	if ! tar --create --gzip --numeric-owner --acls --xattrs --warning=no-file-ignored --file "$STAGING_DIR/$archive" -C "$STAGING_DIR" volumes .env INSTALL_INFO.txt; then
		ERROR="tar failed"
		log "FAILED at step $STEP: $ERROR"
		alert "the archive could not be made" "The backup of $today failed while compressing the copy. The service is up. No archive was made."
		exit 1
	fi
	ARCHIVE_NAME="$archive"
	chmod 600 "$STAGING_DIR/$ARCHIVE_NAME"
	ARCHIVE_BYTES=$(stat -c %s "$STAGING_DIR/$ARCHIVE_NAME")

	STEP=store
	mv -f "$STAGING_DIR/$ARCHIVE_NAME" "$BACKUP_DIR/$ARCHIVE_NAME" || fail "the archive could not be moved to $BACKUP_DIR"
	rm -rf "$STAGING_DIR"
	STAGING_DIR=""
	STORED_IN="$BACKUP_DIR"
	log "archive stored: $BACKUP_DIR/$ARCHIVE_NAME, $ARCHIVE_BYTES bytes"

	STEP=offsite
	if [ -n "$offsite" ]; then
		OFFSITE_TARGET="$offsite"
		if ! rsync -a -e "ssh ${SSH_OPTIONS[*]}" "$BACKUP_DIR/$ARCHIVE_NAME" "$offsite/" </dev/null; then
			ERROR="the archive could not be sent to $offsite"
			log "FAILED at step $STEP: $ERROR"
			alert "the archive did not leave the server" "The backup of $today was made but $ERROR. It is kept in $BACKUP_DIR on the server."
			RESULT=partial
			exit 1
		fi
		OFFSITE_SENT=1
		log "archive sent off-site: $offsite"
		if [ "$delete_local" = "yes" ]; then
			rm -f "$BACKUP_DIR/$ARCHIVE_NAME"
			STORED_IN="$offsite"
			log "archive deleted here, as configured"
		fi
	fi

	STEP=rotation
	cutoff=$(date -d "$today $keep_days days ago" +%F)
	rotate_local "$BACKUP_DIR" "$cutoff"
	[ -n "$offsite" ] && rotate_remote "${offsite%%:*}" "${offsite#*:}" "$cutoff"

	STEP=done
	RESULT=success
	log "backup done in $(($(date +%s) - STARTED_AT)) seconds, $keep_days backups kept at most"
}

run
