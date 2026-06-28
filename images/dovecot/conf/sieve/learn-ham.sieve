require ["vnd.dovecot.pipe", "copy", "imapsieve", "environment", "variables"];

if environment :matches "imap.user" "*" {
  set "username" "${1}";
}

# Skip ham learning when the destination is Trash: deleting a spam from the
# Junk folder must NOT undo the per-recipient blocklist. Only an explicit
# move to a kept-mail folder (Inbox, Archive, etc.) counts as "actually not
# spam".
if not environment :matches "imap.mailbox" "Trash" {
  pipe :copy "sa-learn-pipe.sh" ["ham", "${username}"];
}
