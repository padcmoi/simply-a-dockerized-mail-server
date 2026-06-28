# AUTOROUTER

Per-sender auto-routing driven by IMAP drag-and-drop. A user moves an
inbox mail into one of their own folders, and from then on every future
mail from the same sender lands in that folder automatically.

The rules show up in Roundcube **Settings -> Filters**, named
`AUTOROUTER <folder> <sender>`, so the user can edit or delete them by
hand alongside their hand-crafted filters.

## Behaviour matrix

| user action                                                                                               | effect on the AUTOROUTER rule for that sender                                                                  |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| drag mail from `INBOX` to a USER folder (e.g. `DA`)                                                       | **create** rule `AUTOROUTER DA <sender>`                                                                       |
| drag mail from `INBOX` to a different USER folder (e.g. `DF`)                                             | **update** the rule in place to `AUTOROUTER DF <sender>` -- no duplicate, no leftover from the previous folder |
| drag mail from `INBOX` to a SYSTEM folder (`Drafts`, `Sent`, `Junk`, `Trash`, `Archive`)                  | no-op                                                                                                          |
| drag mail from a USER folder back to `INBOX`                                                              | **delete** the rule -- the rule is gone for that sender                                                        |
| drag mail from a SYSTEM folder back to `INBOX` (e.g. Junk -> INBOX spam unblock, Trash -> INBOX undelete) | rule **kept** -- the move was for spam un-marking or undeletion, not for opting out of routing                 |
| drag user folder to user folder (e.g. `DA -> DF`)                                                         | no-op -- trigger 3 only fires when source = INBOX                                                              |
| edit / delete the rule via Roundcube Filtres                                                              | works exactly like any user-written rule                                                                       |

System folders are recognised by literal name **AND** by Dovecot
SPECIAL-USE flag where available: `INBOX`, `Drafts`, `Sent`, `Junk`,
`Trash`, `Archive`, `Archives`.

## Architecture

```
IMAP COPY/MOVE event
     |
     v
+----------------------------------------------------------------+
| imap_sieve trigger                                             |
|   trigger 3 (`name=*, from=INBOX, causes=COPY`)                |
|     -> auto-route.sieve  -> auto-route-pipe.sh -> hook 10      |
|        (skip if destination is a system folder)                |
|        => `# rule:[AUTOROUTER <dest> <from>]` upserted in the  |
|           user's roundcube.sieve.                              |
|                                                                |
|   trigger 4 (`name=INBOX, from=*, causes=COPY`)                |
|     -> auto-route-undo.sieve -> auto-route-undo-pipe.sh        |
|        -> hook 10                                              |
|        => `doveadm fetch mailbox '*' header Message-ID <id>`   |
|           recovers the source (pigeonhole fires the trigger    |
|           BEFORE the EXPUNGE that completes a MOVE, so the     |
|           original copy still exists in the source mailbox).   |
|           If every non-INBOX hit is a system folder, the rule  |
|           is kept; otherwise the matching                      |
|           `# rule:[AUTOROUTER ... <from>]` block is removed.   |
+----------------------------------------------------------------+
     |
     v
~/sieve/roundcube.sieve  -- rewritten in CRLF + Roundcube-compatible
                            format (allof, `{` on its own line,
                            tab-indented body) so the file remains
                            editable from Roundcube Filtres.
     |
     v
sievec recompiles to .svbin so the next delivery uses the updated rule
without waiting for dovecot to notice the file change.
```

## Why hand-crafted rules are never touched

Both hooks key off the **marker prefix** `# rule:[AUTOROUTER `. A
user-named filter (`test123`, `Receipts`, ...) keeps its own
`# rule:[<name>]` marker and is invisible to the awk pass. Even if a
user filter happens to do `fileinto "DA"` for the same sender, the
AUTOROUTER undo trigger leaves it alone -- only entries named
`AUTOROUTER ...` are in scope.

## Why pigeonhole's source-mailbox limitation forced the doveadm hack

`imap_sieve` exposes `imap.mailbox` (= destination) but not the source
of a COPY event. The trigger config can filter by source
(`imapsieve_mailbox4_from = INBOX`) but the **sieve script** itself does
not know whether the user dragged from `Junk` (spam unblock procedure)
or from `DA` (real auto-route undo).

Workaround documented inline in
[`auto-route-undo-pipe.sh`](../../images/dovecot/conf/sieve/bin/auto-route-undo-pipe.sh):
pigeonhole fires `_name = INBOX, _causes = COPY` triggers **before** the
EXPUNGE that completes a MOVE, so the original copy still exists in the
source mailbox at trigger time. The pipe does
`doveadm fetch -u <user> mailbox '*' header Message-ID <id>`, takes
every non-INBOX hit as a candidate source, and only proceeds with the
deletion when at least one source is a user folder.

## Generated rule format

The hook writes exactly what Roundcube's `rcube_sieve_script` PHP
generator produces, so the rule shows up as a regular filter in
**Settings -> Filters**:

```
# rule:[AUTOROUTER DF padcmoi@naskot.fr]
if allof (address :is "From" "padcmoi@naskot.fr")
{
	fileinto "DF";
	stop;
}
```

CRLF line endings. `allof (...)` wrapper even for a single test (mimics
Roundcube). `{` on its own line. TAB-indented body. The `stop;` after
the fileinto prevents subsequent rules from re-classifying the message
-- combined with `sieve_before` for spam-to-junk, this is what makes the
priority order documented in [delivery/](../delivery/README.md) hold.

## Visible from Roundcube

Once a rule is upserted, the user sees it in **Settings -> Filters**
under the active script (typically `roundcube`). The name is the marker
text -- `AUTOROUTER DF padcmoi@naskot.fr` -- which makes "what does this
do" obvious at a glance. The user can:

- **edit** it via the form -- our hooks will continue to update it on
  future drag events as long as the marker prefix stays `AUTOROUTER`.
- **delete** it via the trash icon -- the next drag from INBOX to a user
  folder re-creates it.
- **rename** the rule -- once the `AUTOROUTER` marker is gone the rule
  becomes a normal user filter, our hooks no longer touch it.

## How to debug

- `docker exec mail-dovecot cat /var/mail/vhosts/<domain>/<user>/sieve/roundcube.sieve`
  -- the source of truth.
- `docker exec mail-dovecot tail -f /var/log/mail/dovecot.log` -- look
  for `sieve:` lines mentioning `pipe`/`auto-route`.
- The hooks call `sievec` to recompile after every change; if recompile
  fails, the dovecot log will show the syntax error.
- Manual unit test:

  ```
  docker exec -i mail-dovecot /usr/local/lib/dovecot/sieve/auto-route-pipe.sh user@example.com DA <<EOF
  From: sender@example.com
  Subject: probe

  body
  EOF
  ```

## How it is tested

See [tests/05-autorouter.sh](../../tests/05-autorouter.sh). All four
behaviours (create, update, undo from user folder, keep on system
folder for Junk/Trash/Drafts/Archive) have a dedicated check.
