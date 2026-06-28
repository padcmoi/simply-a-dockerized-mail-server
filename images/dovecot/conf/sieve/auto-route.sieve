require ["vnd.dovecot.pipe", "copy", "imapsieve", "environment", "variables"];

if environment :matches "imap.user" "*" {
  set "username" "${1}";
}
if environment :matches "imap.mailbox" "*" {
  set "dest" "${1}";
}

# Trigger config already restricts source = INBOX and cause = COPY. We only
# need to gate the destination here: skip any system folder so that moving a
# mail to Drafts / Sent / Junk / Trash / Archives never creates an auto-route
# rule. Rule creation/update happens only for user-created folders.
if string :is "${dest}" ["INBOX", "Drafts", "Sent", "Junk", "Trash", "Archive", "Archives"] {
  stop;
}

pipe :copy "auto-route-pipe.sh" ["${username}", "${dest}"];
