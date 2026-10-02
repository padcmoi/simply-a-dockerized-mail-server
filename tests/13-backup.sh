#!/usr/bin/env bash
# The backup scripts: scripts/backup.install.sh (configuration and cron entry)
# and its shortcut backup.sh at the root of the project,
# scripts/backup.apply.sh (a change asked from the manager) and
# scripts/backup.sh (one cold backup). Everything here works on temporary
# files: the real backup.conf and the real cron entry are never touched, no
# alert is mailed, and the reports go to a stand-in for the manager.
#
# A backup copies INSTALL_INFO.txt, which install.sh writes. A checkout that
# was never installed, like the one of the CI, has none, and every run would
# refuse for that before reaching what is checked here: a stand-in is written
# for the time of the runs and removed after. One that exists is not touched.
#
# The checks that need root are skipped without passwordless sudo. The full
# backup stops the whole stack for the time of a copy, so it only runs when
# BACKUP_TEST_FULL=1 is set.

BACKUP_INSTALL="$PROJECT_DIR/scripts/backup.install.sh"
BACKUP_WRAPPER="$PROJECT_DIR/backup.sh"
BACKUP_APPLY="$PROJECT_DIR/scripts/backup.apply.sh"
BACKUP_RUN="$PROJECT_DIR/scripts/backup.sh"

backup_running_containers() {
	docker ps -q --filter "label=com.docker.compose.project.working_dir=$PROJECT_DIR" | sort | md5sum | cut -d' ' -f1
}

t_backup_static() {
	section "Backup: files"
	local file
	for file in backup.conf backup/.staging backup/backup-2026-01-01.tar.gz; do
		if git -C "$PROJECT_DIR" check-ignore -q "$file"; then
			pass "backup.gitignore.$file" "ignored"
		else
			fail "backup.gitignore.$file" "not ignored by git"
		fi
	done
	for file in "$BACKUP_WRAPPER" "$BACKUP_INSTALL" "$BACKUP_APPLY" "$BACKUP_RUN" "$PROJECT_DIR/scripts/backup.common.sh"; do
		if bash -n "$file" 2>/dev/null; then
			pass "backup.syntax.$(basename "$file")" "parses"
		else
			fail "backup.syntax.$(basename "$file")" "bash -n fails"
		fi
	done
	if [[ "$(id -u)" != "0" ]]; then
		"$BACKUP_RUN" >/dev/null 2>&1
		assert_eq "backup.run.refuses_without_root" "2" "$?"
		"$BACKUP_INSTALL" >/dev/null 2>&1 </dev/null
		assert_eq "backup.install.refuses_without_root" "2" "$?"
		local refusal
		refusal=$("$BACKUP_WRAPPER" 2>&1 </dev/null)
		assert_eq "backup.wrapper.refuses_without_root" "2" "$?"
		assert_contains "backup.wrapper.names_itself" "sudo $BACKUP_WRAPPER" "$refusal"
	fi
}

t_backup_install() {
	section "Backup: install, update, remove"
	local work conf cron out
	work=$(mktemp -d)
	conf="$work/backup.conf"
	cron="$work/cron"
	local run=(sudo -n env "BACKUP_CONF=$conf" "BACKUP_CRON_FILE=$cron" "BACKUP_MANAGED_DIR=$work/managed" "$BACKUP_INSTALL")

	printf '\n\n%s\n' "$work/archives" | "${run[@]}" >/dev/null 2>&1
	assert_eq "backup.install.three_questions_only" "0" "$?"
	assert_eq "backup.install.default_time" "BACKUP_TIME=02:30" "$(grep '^BACKUP_TIME=' "$conf" 2>/dev/null)"
	assert_eq "backup.install.default_keep" "BACKUP_KEEP_DAYS=5" "$(grep '^BACKUP_KEEP_DAYS=' "$conf" 2>/dev/null)"
	assert_eq "backup.install.no_offsite" "BACKUP_OFFSITE=" "$(grep '^BACKUP_OFFSITE=' "$conf" 2>/dev/null)"
	assert_contains "backup.install.cron_backup_line" "30 2 * * * root cd \"$PROJECT_DIR\" && scripts/backup.sh" "$(cat "$cron" 2>/dev/null)"
	assert_contains "backup.install.cron_apply_line" "* * * * * root cd \"$PROJECT_DIR\" && scripts/backup.apply.sh" "$(cat "$cron" 2>/dev/null)"
	assert_eq "backup.install.cron_sets_no_time_zone" "0" "$(grep -c '^CRON_TZ' "$cron" 2>/dev/null)"
	assert_contains "backup.install.publishes_config" "BACKUP_TIME=02:30" "$(sudo -n cat "$work/managed/config.conf" 2>/dev/null)"

	out=$(printf '\n' | sudo -n env "BACKUP_CONF=$conf" "BACKUP_CRON_FILE=$cron" "BACKUP_MANAGED_DIR=$work/managed" "$BACKUP_WRAPPER" 2>/dev/null)
	assert_contains "backup.wrapper.runs_the_install" "Nothing changed." "$out"

	printf 'u\n99:99\n04:05\n0\n3\n\n' | "${run[@]}" >/dev/null 2>&1
	assert_eq "backup.install.update_time" "BACKUP_TIME=04:05" "$(grep '^BACKUP_TIME=' "$conf")"
	assert_eq "backup.install.update_keep" "BACKUP_KEEP_DAYS=3" "$(grep '^BACKUP_KEEP_DAYS=' "$conf")"
	assert_contains "backup.install.update_cron" "5 4 * * * root" "$(cat "$cron")"

	printf 'r\n' | "${run[@]}" >/dev/null 2>&1
	if [[ ! -e "$cron" && ! -e "$conf" && ! -e "$work/managed/config.conf" ]]; then
		pass "backup.install.remove" "cron entry, backup.conf and published config gone"
	else
		fail "backup.install.remove" "the cron entry, backup.conf or the published config is still there"
	fi
	if sudo -n test -d "$work/archives"; then
		pass "backup.install.remove_keeps_archives" "the archives folder is kept"
	else
		fail "backup.install.remove_keeps_archives" "the archives folder was deleted"
	fi

	printf '\n\n%s\n' "$work/archives" | "${run[@]}" >/dev/null 2>&1
	assert_eq "backup.install.after_remove_defaults" "BACKUP_TIME=02:30" "$(grep '^BACKUP_TIME=' "$conf" 2>/dev/null)"
	sudo -n rm -rf "$work"
}

t_backup_apply() {
	section "Backup: a change asked from the manager"
	local work conf cron managed status
	work=$(mktemp -d)
	conf="$work/backup.conf"
	cron="$work/cron"
	managed="$work/managed"
	local env=(sudo -n env "BACKUP_CONF=$conf" "BACKUP_CRON_FILE=$cron" "BACKUP_MANAGED_DIR=$managed")
	request() {
		printf 'REQUEST_ID=11111111-1111-1111-1111-111111111111\nBACKUP_TIME=%s\nBACKUP_KEEP_DAYS=%s\nBACKUP_OFFSITE=%s\nBACKUP_OFFSITE_DELETE_LOCAL=%s\n%s' "$@" |
			sudo -n tee "$managed/request.conf" >/dev/null
	}

	mkdir -p "$managed"
	request "03:00" "4" "" "yes" ""
	"${env[@]}" "$BACKUP_APPLY" >/dev/null 2>&1
	assert_contains "backup.apply.refused_when_not_installed" "STATE=error" "$(sudo -n cat "$managed/status.conf" 2>/dev/null)"

	printf '\n\n%s\n' "$work/archives" | "${env[@]}" "$BACKUP_INSTALL" >/dev/null 2>&1
	"${env[@]}" "$BACKUP_APPLY" >/dev/null 2>&1
	assert_eq "backup.apply.nothing_asked" "0" "$?"

	request "06:15" "9" "bob@backup.example.com:/srv/mail" "no" ""
	"${env[@]}" "$BACKUP_APPLY" >/dev/null 2>&1
	assert_eq "backup.apply.time" "BACKUP_TIME=06:15" "$(grep '^BACKUP_TIME=' "$conf")"
	assert_eq "backup.apply.keep" "BACKUP_KEEP_DAYS=9" "$(grep '^BACKUP_KEEP_DAYS=' "$conf")"
	assert_eq "backup.apply.offsite" "BACKUP_OFFSITE=bob@backup.example.com:/srv/mail" "$(grep '^BACKUP_OFFSITE=' "$conf")"
	assert_contains "backup.apply.cron" "15 6 * * * root" "$(cat "$cron")"
	assert_contains "backup.apply.status" "STATE=applied" "$(sudo -n cat "$managed/status.conf")"
	assert_contains "backup.apply.republishes" "BACKUP_TIME=06:15" "$(sudo -n cat "$managed/config.conf")"
	if [[ ! -e "$managed/request.conf" ]]; then
		pass "backup.apply.request_consumed" "request.conf removed"
	else
		fail "backup.apply.request_consumed" "request.conf still there"
	fi

	printf 'u\n07:00\n\n\n' | "${env[@]}" "$BACKUP_INSTALL" >/dev/null 2>&1
	assert_eq "backup.install.update_keeps_manager_offsite" "BACKUP_OFFSITE=bob@backup.example.com:/srv/mail" "$(grep '^BACKUP_OFFSITE=' "$conf")"
	assert_eq "backup.install.update_keeps_manager_choice" "BACKUP_OFFSITE_DELETE_LOCAL=no" "$(grep '^BACKUP_OFFSITE_DELETE_LOCAL=' "$conf")"
	assert_eq "backup.install.update_after_manager" "BACKUP_TIME=07:00" "$(grep '^BACKUP_TIME=' "$conf")"

	request "02:30" "5" "x@y:/a; touch $work/pwned" "yes" "BACKUP_DIR=/etc"
	"${env[@]}" "$BACKUP_APPLY" >/dev/null 2>&1
	assert_contains "backup.apply.hostile_refused" "STATE=error" "$(sudo -n cat "$managed/status.conf")"
	assert_eq "backup.apply.hostile_changes_nothing" "BACKUP_TIME=07:00" "$(grep '^BACKUP_TIME=' "$conf")"
	assert_eq "backup.apply.dir_untouched" "BACKUP_DIR=$work/archives" "$(grep '^BACKUP_DIR=' "$conf")"
	if [[ ! -e "$work/pwned" ]]; then
		pass "backup.apply.nothing_executed" "the request ran nothing"
	else
		fail "backup.apply.nothing_executed" "the request executed a command"
	fi

	section "Backup: an archive sent off-site, brought back for the manager"
	retrieve() {
		printf 'REQUEST_ID=22222222-2222-2222-2222-222222222222\nNAME=%s\nFROM=%s\nBYTES=%s\n' "$@" |
			sudo -n tee "$managed/retrieve.conf" >/dev/null
		"${env[@]}" "$BACKUP_APPLY" >/dev/null 2>&1
		sudo -n cat "$managed/retrieve-status.conf" 2>/dev/null
	}
	assert_contains "backup.retrieve.refuses_a_name_that_is_no_archive" "ERROR=the name is not the one of an archive" \
		"$(retrieve "../../etc/passwd" "bob@backup.example.com:/srv/mail" "1")"
	assert_contains "backup.retrieve.refuses_a_hostile_place" "ERROR=the place of the archive is not user@host:/path" \
		"$(retrieve "backup-2026-01-01.tar.gz" "x@y:/a; touch $work/pwned" "1")"
	if [[ ! -e "$work/pwned" ]]; then
		pass "backup.retrieve.nothing_executed" "the request ran nothing"
	else
		fail "backup.retrieve.nothing_executed" "the request executed a command"
	fi
	assert_contains "backup.retrieve.refuses_without_room" "ERROR=not enough disk space to bring the archive back" \
		"$(retrieve "backup-2026-01-01.tar.gz" "bob@backup.example.com:/srv/mail" "999999999999999")"
	assert_contains "backup.retrieve.says_when_it_cannot_reach_the_place" "ERROR=the archive could not be brought back from nobody@host.invalid:/srv/mail" \
		"$(retrieve "backup-2026-01-01.tar.gz" "nobody@host.invalid:/srv/mail" "1")"
	sudo -n touch "$work/archives/backup-2026-01-02.tar.gz"
	status=$(retrieve "backup-2026-01-02.tar.gz" "nobody@host.invalid:/srv/mail" "1")
	assert_contains "backup.retrieve.already_there_is_done" "STATE=done" "$status"
	assert_contains "backup.retrieve.answer_names_the_archive" "NAME=backup-2026-01-02.tar.gz" "$status"
	assert_contains "backup.retrieve.answer_names_the_request" "REQUEST_ID=22222222-2222-2222-2222-222222222222" "$status"
	if [[ ! -e "$managed/retrieve.conf" ]]; then
		pass "backup.retrieve.request_consumed" "retrieve.conf removed"
	else
		fail "backup.retrieve.request_consumed" "retrieve.conf still there"
	fi
	assert_eq "backup.retrieve.leaves_only_archives" "backup-2026-01-02.tar.gz" "$(sudo -n ls -A "$work/archives" 2>/dev/null)"
	assert_eq "backup.retrieve.leaves_the_configuration_alone" "BACKUP_TIME=07:00" "$(grep '^BACKUP_TIME=' "$conf")"
	sudo -n rm -rf "$work"
}

backup_sender() {
	local file="$1" status="$2"
	printf '#!/bin/sh\ncat >>"%s"\necho >>"%s"\nexit %s\n' "$file" "$file" "$status" >"$file.sh"
	chmod +x "$file.sh"
	printf '%s' "$file.sh"
}

t_backup_no_room() {
	section "Backup: not enough room stops nothing, and leaves no file behind"
	local work before after status taken refused run
	work=$(mktemp -d)
	mkdir -p "$work/tiny"
	if ! sudo -n mount -t tmpfs -o size=2m tmpfs "$work/tiny" 2>/dev/null; then
		skip "backup.no_room" "cannot mount a tmpfs here"
		rm -rf "$work"
		return
	fi
	printf 'BACKUP_TIME=02:30\nBACKUP_KEEP_DAYS=5\nBACKUP_DIR=%s\nBACKUP_OFFSITE=\n' "$work/tiny" >"$work/backup.conf"
	taken=$(backup_sender "$work/taken.jsonl" 0)
	refused=$(backup_sender "$work/untaken.jsonl" 1)
	run=(sudo -n env "BACKUP_CONF=$work/backup.conf" "BACKUP_ALERT_SCRIPT=/bin/true")

	before=$(backup_running_containers)
	"${run[@]}" "BACKUP_REPORT_SENDER=$refused" "$BACKUP_RUN" >/dev/null 2>&1
	status=$?
	after=$(backup_running_containers)
	assert_eq "backup.no_room.exit_code" "1" "$status"
	assert_eq "backup.no_room.containers_untouched" "$before" "$after"
	assert_eq "backup.untaken_report.only_thing_left" ".reports" "$(sudo -n ls -A "$work/tiny" | tr '\n' ' ' | sed 's/ $//')"
	assert_eq "backup.untaken_report.kept" "1" "$(sudo -n find "$work/tiny/.reports" -name '*.json' | wc -l)"
	assert_contains "backup.untaken_report.holds_the_error" '"error":"not enough disk space"' "$(sudo -n sh -c "cat '$work/tiny/.reports/'*.json" 2>/dev/null)"

	sudo -n sh -c "echo '2026-01-01T00:00:00Z backup started, archive backup-2026-01-01.tar.gz' >'$work/tiny/backup.log'"
	sleep 1
	"${run[@]}" "BACKUP_REPORT_SENDER=$taken" "$BACKUP_RUN" >/dev/null 2>&1
	assert_eq "backup.taken_report.nothing_left_in_the_folder" "" "$(sudo -n ls -A "$work/tiny")"
	assert_eq "backup.taken_report.all_three_delivered" "3" "$(grep -c '"run":' "$work/taken.jsonl" 2>/dev/null)"
	assert_contains "backup.taken_report.oldest_run_first" 'backup started, archive backup-2026-01-01.tar.gz' "$(head -1 "$work/taken.jsonl" 2>/dev/null)"
	assert_eq "backup.taken_report.untaken_one_delivered_too" "2" "$(grep -c '"error":"not enough disk space"' "$work/taken.jsonl" 2>/dev/null)"
	assert_contains "backup.interrupted_run.reported" '"step":"unknown","error":"this run was interrupted before it could end"' "$(cat "$work/taken.jsonl" 2>/dev/null)"
	assert_contains "backup.interrupted_run.keeps_its_log" 'backup started, archive backup-2026-01-01.tar.gz' "$(cat "$work/taken.jsonl" 2>/dev/null)"
	assert_contains "backup.interrupted_run.dated_from_its_log" '"startedAt":"2026-01-01T00:00:00Z"' "$(cat "$work/taken.jsonl" 2>/dev/null)"
	assert_eq "backup.log.stamped_in_utc" "0" "$(grep -o '"log":\[[^]]*\]' "$work/taken.jsonl" | sed 's/^"log":\[//; s/\]$//; s/","/"\n"/g' | grep -vc '^"[0-9]\{4\}-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z ')"
	assert_contains "backup.report.says_where_the_archives_are" "\"archivesDir\":\"$work/tiny\",\"archivesProjectDir\":\"\"" "$(tail -2 "$work/taken.jsonl" 2>/dev/null)"

	sudo -n umount "$work/tiny"
	sudo -n rm -rf "$work"
}

t_backup_full() {
	section "Backup: one full run"
	local work archive today recent status listing sender
	work=$(mktemp -d)
	today=$(date +%F)
	recent="backup-$(date -d '2 days ago' +%F).tar.gz"
	mkdir -p "$work/archives"
	touch "$work/archives/backup-2020-01-01.tar.gz" "$work/archives/$recent" "$work/archives/manual-dump.sql"
	printf 'BACKUP_TIME=02:30\nBACKUP_KEEP_DAYS=5\nBACKUP_DIR=%s\nBACKUP_OFFSITE=\n' "$work/archives" >"$work/backup.conf"
	sender=$(backup_sender "$work/taken.jsonl" 0)
	sudo -n env "BACKUP_CONF=$work/backup.conf" "BACKUP_ALERT_SCRIPT=/bin/true" "BACKUP_REPORT_SENDER=$sender" "$BACKUP_RUN" >/dev/null 2>&1
	status=$?
	archive="$work/archives/backup-$today.tar.gz"
	assert_eq "backup.full.exit_code" "0" "$status"
	listing=$(sudo -n tar -tzf "$archive" 2>/dev/null)
	assert_contains "backup.full.archive_has_env" ".env" "$listing"
	assert_contains "backup.full.archive_has_install_info" "INSTALL_INFO.txt" "$listing"
	assert_contains "backup.full.archive_has_database" "volumes/mysql/" "$listing"
	assert_eq "backup.full.archive_mode" "600" "$(sudo -n stat -c %a "$archive" 2>/dev/null)"
	assert_eq "backup.full.only_archives_left" "$(printf '%s\n' "$recent" "backup-$today.tar.gz" manual-dump.sql | sort | tr '\n' ' ')" "$(sudo -n ls -A "$work/archives" | sort | tr '\n' ' ')"
	assert_contains "backup.full.report_result" '"result":"success","step":"done"' "$(cat "$work/taken.jsonl" 2>/dev/null)"
	assert_contains "backup.full.report_holds_the_log" 'backup done in' "$(cat "$work/taken.jsonl" 2>/dev/null)"
	assert_contains "backup.full.report_lists_the_archive" "{\"name\":\"backup-$today.tar.gz\",\"bytes\":" "$(cat "$work/taken.jsonl" 2>/dev/null)"
	local name down=""
	for name in "${STACK_CONTAINERS[@]}"; do
		[[ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null)" == "true" ]] || down+="$name "
	done
	assert_eq "backup.full.stack_back_up" "" "$down"
	sudo -n rm -rf "$work"
}

t_backup_static
if sudo -n true 2>/dev/null; then
	t_backup_install
	t_backup_apply
	backup_info_stand_in=0
	if [[ ! -e "$PROJECT_DIR/INSTALL_INFO.txt" ]]; then
		echo "stand-in written by tests/13-backup.sh" >"$PROJECT_DIR/INSTALL_INFO.txt" && backup_info_stand_in=1
	fi
	t_backup_no_room
	if [[ "${BACKUP_TEST_FULL:-0}" == "1" ]]; then
		t_backup_full
	else
		skip "backup.full" "stops the whole stack: set BACKUP_TEST_FULL=1 to run it"
	fi
	if [[ "$backup_info_stand_in" == "1" ]]; then
		rm -f "$PROJECT_DIR/INSTALL_INFO.txt"
	fi
else
	skip "backup.root_checks" "passwordless sudo is not available"
fi
