# Groups and the permission editors

A group bundles permissions and shares them across accounts. Permissions are
never granted to an account directly: they are granted to a group, and accounts
inherit from every group they belong to. Root belongs to no group and holds no
rows.

## The list

[`/groups`](../../manager-ui/app/pages/groups/index.vue), requiring
`groups:access` + `list-groups`. Name, description, owner, member count, plus
badges:

- **Default** -- newly invited accounts with no explicit group inherit this one.
  Exactly one group can hold it.
- **Protected** -- can never be deleted, by anyone, root included. Only root can
  set or clear the flag.
- **Invisible** -- completely hidden from every non-root account. It appears
  nowhere, not even in this list, and neither the group nor its permissions can
  be viewed or changed. Only root can see it or change the flag.
- **You are a member** -- shown on your own groups.

**New group** ([`GroupFormModal`](../../manager-ui/app/components/groups/GroupFormModal.vue))
takes a name, a description and those three flags, each with the hint above
spelled out next to it. Deleting confirms first.

## Group detail

[`/groups/:id`](../../manager-ui/app/pages/groups/[id]/index.vue) and its
siblings share a tab bar
([`GroupDetailTabs`](../../manager-ui/app/components/groups/GroupDetailTabs.vue)):

| Tab | Route | Requires |
| --- | --- | --- |
| Info (the group name) | `/groups/:id` | `view-group` |
| Owner | `/groups/:id/owner` | `view-group` |
| Members | `/groups/:id/members` | `list-group-members` |
| Application | `/groups/:id/acl/app` | `edit-group-global-permissions` |
| Domain | `/groups/:id/acl/domain/:domain?` | `edit-group-domain-permissions` |

**Info** edits the name, the description and the default-group flag.

**Owner** shows the current owner and offers a transfer. Only the owner or root
can transfer, which is enforced in the service rather than by a route decorator:
`transfer-group-ownership` is an *alternative* to owning the group, never a
second condition stacked on top of it. The same applies to `add-group-member`
and `remove-group-member`.

**Members** lists the accounts in the group with add and remove, plus two bulk
buttons showing their target counts: **Assign all accounts** and **Remove all**.
The member picker reads `GET /accounts/names`, guarded by
`accounts:list-account-names` rather than the heavier `list-accounts`: naming
members is not a reason to read everyone's email and role, which is exactly why
the `groups` resource declares that dependency.

## The two ACL editors

[Application](../../manager-ui/app/components/groups/GroupGlobalPermissions.vue)
grants global permissions; [Domain](../../manager-ui/app/components/groups/GroupDomainPermissions.vue)
grants them per domain, with a domain picker at the top and one independent set
per domain. Both render the same
[`GroupPermissionResourceBlock`](../../manager-ui/app/components/groups/GroupPermissionResourceBlock.vue):
one block per resource, one checkbox per action, with **All** / **None** per
resource and **Check all** / **Uncheck all** across everything visible.

Every resource and action carries a human label from
[`i18n/locales/*/groups.ts`](../../manager-ui/i18n/locales/en_GB/groups.ts).
The checkbox reads "Rotate the DKIM key", not `rotate-dkim-key`. Labels are
typed against the catalog, so an action added to
[`permission-catalog.ts`](../../manager-api/src/core/custom-permission-guard/permission-catalog.ts)
without a label fails the typecheck instead of surfacing as a raw key.

### Autosave

There is no Save button. Every click debounces a save one second later, with a
"Saving..." indicator and the rule stated above the blocks. The debounce spans
a burst of clicks, including the bulk buttons, so checking a whole resource
sends one request.

### Dependencies cascade

Some resources cannot function without another. `recipients`, `aliases`,
`mailboxes`, `quotas`, `rspamd`, `admin` and `dkim` all depend on
`domain:access`; `groups` depends on `accounts:access` + `list-account-names`;
`tickets` depends on `domains:access`.

The `mailboxes` domain resource ("Mailboxes") is the domain side of recipient /
alias ownership: `assign-recipient-owner`, `unassign-recipient-owner`,
`assign-alias-owner`, `unassign-alias-owner`. The account side of the same
ownership is a set of global `accounts` actions with the same four names, which
gate managing ownership across every domain from an account (see `accounts.md`
and `mailboxes.md`).

The editor reads that map from the API and applies it in both directions:
checking a dependent action also grants what it needs, and clearing a
prerequisite clears everything that depended on it. The API enforces the same
rules, so the UI is a convenience and not the guarantee.

`superadmin` inverts the pattern: its dependency list is every other global
resource with all of its actions, so ticking `superadmin:access` grants the
whole server in one click. That list is built from the catalog rather than
frozen, so a new action joins it automatically.

### What you cannot grant

The editor only shows actions the caller could grant, which is the display
counterpart of the server-side anti-escalation rule: you cannot grant a
permission you do not hold yourself. The saved payload is built from the same
filtered set, so a checked-but-disabled state can never be sent.

### Anti-lockout

There must always remain at least one group able to manage groups. The API
refuses the save that would remove the last one, root included, and the UI
surfaces the refusal as an error toast. Groups that never held that permission
are not counted, so the check does not fire spuriously.

## Seeing your own permissions

Two read-only views on `/profile`, described in [profile.md](profile.md):
[`MyGroupPermissionsModal`](../../manager-ui/app/components/profile/MyGroupPermissionsModal.vue)
shows what one group grants, and
[`ProfileEffectivePermissionsModal`](../../manager-ui/app/components/profile/ProfileEffectivePermissionsModal.vue)
shows the union actually in force for you, which is what the guards evaluate.
