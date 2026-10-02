#!/usr/bin/env bash
# Installs, updates or removes the daily backup of the mail server. A shortcut
# for scripts/backup.install.sh, where the backup scripts live. It does not run
# a backup: that is scripts/backup.sh, which the cron entry starts every day.
#
# Usage: sudo ./backup.sh
BACKUP_ENTRYPOINT="$0" exec "$(dirname "$0")/scripts/backup.install.sh" "$@"
