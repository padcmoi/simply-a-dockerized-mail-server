require ["vnd.dovecot.pipe", "copy", "imapsieve", "environment", "variables"];

if environment :matches "imap.user" "*" {
  set "username" "${1}";
}

# Trigger config already restricts destination = INBOX (so a delete-to-Trash
# never reaches us) and cause = COPY (so a flag-change does not either).
# Whether the source was a user folder, Drafts or Junk does not matter: the
# pipe only acts when an AUTOROUTER rule for this exact sender already
# exists in the user's managesieve script, and that pre-condition is met
# only when the user previously moved INBOX -> some-user-folder. Spurious
# triggers (e.g. Drafts -> INBOX, Trash -> INBOX) are silent no-ops.
pipe :copy "auto-route-undo-pipe.sh" ["${username}"];
