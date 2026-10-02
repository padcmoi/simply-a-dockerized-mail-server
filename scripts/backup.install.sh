#!/usr/bin/env bash
# Sets the configuration of the backup and its cron entry, nothing else: it
# installs them, updates them or removes them. Removing deletes the cron entry
# and backup.conf, never the archives. The backup itself is scripts/backup.sh,
# which the cron entry starts every day.
#
# It asks the least: the time, the number of backups kept and the folder of the
# archives. Sending the archives to another server is not asked here: it is set
# from the manager, and scripts/backup.apply.sh applies it. An update made here
# keeps what the manager set.
#
# Usage: sudo ./backup.sh at the root of the project, or sudo scripts/backup.install.sh
set -uo pipefail

# shellcheck source=scripts/backup.common.sh
. "$(dirname "$0")/backup.common.sh"
cd "$PROJECT_DIR"

ask() {
	local label="$1" default="$2" check="$3" answer
	while :; do
		if [ -n "$default" ]; then
			printf "%s [%s]: " "$label" "$default" >&2
		else
			printf "%s: " "$label" >&2
		fi
		IFS= read -r answer || die "no answer given"
		[ -n "$answer" ] || answer="$default"
		if "$check" "$answer"; then
			printf "%s" "$CHECKED"
			return 0
		fi
	done
}

check_time() {
	[[ "$1" =~ $TIME_PATTERN ]] || {
		echo "  a time like 02:30, from 00:00 to 23:59" >&2
		return 1
	}
	CHECKED="$1"
}

check_keep_days() {
	[[ "$1" =~ $KEEP_DAYS_PATTERN ]] || {
		echo "  a number of days from 1 to 999" >&2
		return 1
	}
	CHECKED="$1"
}

check_dir() {
	local typed="$1" dir volumes
	case "$typed" in
	/*) typed="${typed%/}" ;;
	*)
		typed="${typed#./}"
		typed="./${typed%/}"
		;;
	esac
	dir=$(resolve_dir "$typed")
	volumes=$(volumes_dir || true)
	if [ -n "$volumes" ] && [[ "$dir/" == "$volumes/"* ]]; then
		echo "  the archives cannot live inside the volumes folder they back up" >&2
		return 1
	fi
	mkdir -p "$dir" 2>/dev/null && chmod 700 "$dir" || {
		echo "  $dir cannot be created" >&2
		return 1
	}
	CHECKED="$typed"
}

check_choice() {
	case "$1" in
	l | leave | "") CHECKED=leave ;;
	u | update) CHECKED=update ;;
	r | remove) CHECKED=remove ;;
	*)
		echo "  l, u or r" >&2
		return 1
		;;
	esac
}

show_configuration() {
	echo "  time of the backup, every day : $(conf_get BACKUP_TIME) on this server's clock ($(host_timezone))"
	echo "  backups kept at most          : $(conf_get BACKUP_KEEP_DAYS) (one per day)"
	echo "  folder of the archives        : $(conf_get BACKUP_DIR)"
	echo "  off-site, set in the manager  : $(conf_or BACKUP_OFFSITE none)"
	[ -n "$(conf_get BACKUP_OFFSITE)" ] &&
		echo "  delete here once sent         : $(conf_or BACKUP_OFFSITE_DELETE_LOCAL yes)"
	echo "  cron entry                    : $CRON_FILE"
}

install() {
	need_root
	local choice time keep dir offsite delete_local

	if [ -f "$CRON_FILE" ]; then
		echo "The backup is already installed:"
		show_configuration
		choice=$(ask "[l]eave it, [u]pdate it or [r]emove it" "l" check_choice) || exit 2
		case "$choice" in
		leave)
			echo "Nothing changed."
			return 0
			;;
		remove)
			rm -f "$CRON_FILE" "$CONF_FILE"
			unpublish_config
			echo "Backup removed: the cron entry and backup.conf are deleted. The archives are kept."
			return 0
			;;
		esac
	fi

	time=$(ask "Time of the backup, every day, on this server's clock, $(host_timezone) (HH:MM)" "$(conf_or BACKUP_TIME "$DEFAULT_TIME")" check_time) || exit 2
	keep=$(ask "Backups kept at most, one per day" "$(conf_or BACKUP_KEEP_DAYS "$DEFAULT_KEEP_DAYS")" check_keep_days) || exit 2
	dir=$(ask "Folder where the archives go, from the project or as a full path" "$(conf_or BACKUP_DIR "$DEFAULT_DIR")" check_dir) || exit 2

	offsite=$(conf_get BACKUP_OFFSITE)
	is_remote "$offsite" || offsite=""
	delete_local=$(conf_or BACKUP_OFFSITE_DELETE_LOCAL yes)
	[ "$delete_local" = "no" ] || delete_local=yes

	write_conf "$time" "$keep" "$dir" "$offsite" "$delete_local" || die "$CONF_FILE cannot be written"
	write_cron "$time" || die "$CRON_FILE cannot be written"
	publish_config

	echo "Backup installed:"
	show_configuration
	echo "Sending the archives to another server is set from the manager: Backups, then Configure."
}

install
