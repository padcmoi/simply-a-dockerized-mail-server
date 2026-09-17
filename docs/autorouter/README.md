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
| drag mail from `INBOX` to a USER folder when an existing rule already files that mail (e.g. `@domain`)    | no-op: no rule, no postmaster notice (see [Existing rules win](#existing-rules-win))                           |
| drag mail from `INBOX` to a different USER folder (e.g. `DF`)                                             | **update** the rule in place to `AUTOROUTER DF <sender>` -- no duplicate, no leftover from the previous folder |
| drag mail from `INBOX` to a SYSTEM folder (`Drafts`, `Sent`, `Junk`, `Trash`, `Archive`, `Keep`)          | no-op                                                                                                          |
| drag mail from a USER folder back to `INBOX`                                                              | **delete** the rule -- the rule is gone for that sender                                                        |
| drag mail from a SYSTEM folder back to `INBOX` (e.g. Junk -> INBOX spam unblock, Trash -> INBOX undelete) | rule **kept** -- the move was for spam un-marking or undeletion, not for opting out of routing                 |
| drag user folder to user folder (e.g. `DA -> DF`)                                                         | no-op -- trigger 3 only fires when source = INBOX                                                              |
| edit / delete the rule via Roundcube Filtres                                                              | works exactly like any user-written rule                                                                       |

System folders are recognised by their IMAP name only, case-insensitively:
`INBOX`, `Drafts`, `Sent`, `Junk`, `Trash`, `Archive`, `Archives`, `Keep`.
The SPECIAL-USE flag is not consulted, so a folder a client created under
another name (`Spam`, `Sent Messages`, ...) counts as a user folder.

`Keep` is created and subscribed for every mailbox by dovecot. It stores
mail worth keeping without being an archive, so it carries no SPECIAL-USE
flag and clients do not treat it as `\Archive`.

## Architecture

```
IMAP COPY/MOVE event
     |
     v
+----------------------------------------------------------------+
| imap_sieve trigger                                             |
|   trigger 3 (`name=*, from=INBOX, causes=COPY`)                |
|     -> auto-route.sieve  -> auto-route-pipe.sh                 |
|        (skip if destination is a system folder)                |
|        -> sieve-test runs the user's active script on the      |
|           moved mail; stop here if a rule already files it     |
|        -> hook 10, then hook 20 (postmaster notice)            |
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

## Existing rules win

Before any hook runs, [`auto-route-pipe.sh`](../../images/dovecot/conf/sieve/bin/auto-route-pipe.sh)
asks Sieve itself whether the move is already covered. It copies the
user's active script (the one `~/.dovecot.sieve` points to) and runs
`sieve-test` on it with the **moved mail** as input. When the result
contains a `store message in folder` action, an existing rule already
files that mail at delivery time, so the orchestrator exits: no
AUTOROUTER rule is written and no postmaster notice is sent.

The check reads nothing but the Sieve script, so it sees every kind of
rule the user has: AUTOROUTER entries, Roundcube filters on an address,
on a domain, with `contains` or with a `*` pattern. It follows exactly
what Dovecot would do at delivery, in rule order.

The sender's own AUTOROUTER rule is left out of the check only while it
is still the generated form, `address :is "From" "<sender>"`. That keeps
the folder change working (`DA` then `DF` for the same sender). As soon
as the user edits that rule in Roundcube, for instance to cover a whole
domain, it counts like any other filter.

Example: a filter `From contains @messagerie.leboncoin.fr -> leboncoin`
exists. Dragging a mail from `abc123@messagerie.leboncoin.fr` into any
user folder creates nothing.

### The operator matters

A domain filter only covers the domain when its condition can match a
real address. What Roundcube writes for `From ... @pd.fr`, checked
against `toto@pd.fr` and `Toto <toto@pd.fr>`:

| Roundcube operator           | Sieve written                       | files the mail | AUTOROUTER   |
| ---------------------------- | ----------------------------------- | -------------- | ------------ |
| contains                     | `header :contains "from" "@pd.fr"`  | yes            | skipped      |
| contains (on an edited rule) | `address :contains "From" "@pd.fr"` | yes            | skipped      |
| matches `*@pd.fr`            | `address :matches "From" "*@pd.fr"` | yes            | skipped      |
| is equal to                  | `address :is "from" "@pd.fr"`       | no             | creates rule |
| matches `@pd.fr` (no `*`)    | `header :matches "from" "@pd.fr"`   | no             | creates rule |

`is equal to @pd.fr` compares the whole address, which is never just
`@pd.fr`. Such a filter files nothing at delivery either, so the
AUTOROUTER does its normal job. Use `contains` for a domain.

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
- To see what the existence check sees, run the same probe by hand:

  ```
  docker exec mail-dovecot sh -c 'printf "From: sender@example.com\nSubject: probe\n\nbody\n" > /tmp/probe.eml && chmod 644 /tmp/probe.eml && su -s /bin/sh vmail -c "sieve-test /var/mail/vhosts/<domain>/<user>/sieve/roundcube.sieve /tmp/probe.eml"'
  ```

  `store message in folder: <folder>` under `Performed actions` means
  the AUTOROUTER will skip that sender.

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
folder for Junk/Trash/Drafts/Archive) have a dedicated check. The
existence check has no automated check yet; it was verified by hand on
a live mailbox with `contains`, `matches` and `is equal to` filters.
