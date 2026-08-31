import type { MigrationInterface, QueryRunner } from "typeorm";

// The group a fresh install lands on.
//
// A new account with no explicit group inherits the default one, so a server
// without it hands its first invitees nothing at all and every screen answers
// 403. It was created by hand on every install so far; here it comes with the
// schema.
//
// Default, protected and invisible: inherited by new accounts, deletable by
// nobody (root included), and hidden from every non-root account, since what
// everyone silently carries is not something to be browsed or renamed by the
// accounts carrying it.
//
// The rights it grants are the ones an account needs to exist on its own: its
// own API tokens, and the support desk to ask for the rest. Notably NOT
// `domains:access`, which the tickets resource still declares as a dependency:
// that dependency is served to the interface as catalog metadata and re-ticked
// by the group form, it is not enforced when writing, and nothing in the ticket
// routes reads it. Seeding it would hand every account a foot on the domains
// section for nothing.
//
// Owner: none. This runs with the schema, before install.sh seeds the first
// root account, so there is nobody to own it yet; install.sh attaches that
// account once it exists.
//
// An install that already carries a default group keeps it untouched, flags and
// permissions included: this seeds what is missing, it does not impose a shape
// on a server someone has already tuned.

const GLOBAL_PERMISSIONS: [resource: string, action: string][] = [
  ["api-tokens", "access"],
  ["api-tokens", "list-api-tokens"],
  ["api-tokens", "create-api-token"],
  ["api-tokens", "edit-api-token"],
  ["api-tokens", "revoke-api-token"],
  ["api-tokens", "regenerate-api-token"],
  ["api-tokens", "delete-api-token"],
  ["tickets", "access"],
  ["tickets", "list-tickets"],
  ["tickets", "view-ticket"],
  ["tickets", "create-ticket"],
];

export class SeedDefaultGroup1788173888552 implements MigrationInterface {
  name = "SeedDefaultGroup1788173888552";

  // The group and its rights go in together or not at all: a group left behind
  // with half its permissions is worse than no group, since a fresh install
  // would look seeded and hand its accounts a truncated set nobody would think
  // to check. TypeORM already wraps a migration run in a transaction, but that
  // is its default rather than something this file states, and it depends on
  // how the CLI is invoked. Opening one here when none is open makes it true
  // either way, and the guard keeps it from nesting when there already is one.
  async up(queryRunner: QueryRunner): Promise<void> {
    const existing = (await queryRunner.query("SELECT id FROM `groups` WHERE is_default = 1 LIMIT 1")) as { id: string }[];
    if (existing.length) return;

    const ownTransaction = !queryRunner.isTransactionActive;
    if (ownTransaction) await queryRunner.startTransaction();
    try {
      const [{ id }] = (await queryRunner.query("SELECT UUID() AS id")) as { id: string }[];
      await queryRunner.query(
        "INSERT INTO `groups` (id, name, description, owner_id, is_default, is_protected, is_invisible, created_at) " +
          "VALUES (?, 'Default', NULL, NULL, 1, 1, 1, NOW())",
        [id]
      );
      for (const [resource, action] of GLOBAL_PERMISSIONS) {
        await queryRunner.query("INSERT INTO group_global_permissions (group_id, resource, action) VALUES (?, ?, ?)", [
          id,
          resource,
          action,
        ]);
      }
      if (ownTransaction) await queryRunner.commitTransaction();
    } catch (error) {
      if (ownTransaction) await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  // Only the untouched seed goes back: a default group someone has since taken
  // ownership of, or that accounts have joined, is theirs and stays. Its
  // permission rows leave with it through the foreign key.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `groups` WHERE is_default = 1 AND name = 'Default' AND owner_id IS NULL " +
        "AND id NOT IN (SELECT group_id FROM group_members)"
    );
  }
}
