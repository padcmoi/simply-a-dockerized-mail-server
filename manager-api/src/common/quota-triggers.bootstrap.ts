import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";

@Injectable()
export class QuotaTriggersBootstrap implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onApplicationBootstrap() {
    const stmts: string[] = [
      // Drop legacy PascalCase trigger names (pre-snake_case rename) so older
      // deployments do not keep firing two triggers per write after upgrade.
      "DROP TRIGGER IF EXISTS `VirtualUsers_after_insert_quota`",
      "DROP TRIGGER IF EXISTS `VirtualDomains_after_insert_quota`",
      "DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_update_agg`",
      "DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_insert_agg`",
      "DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_delete_agg`",

      "DROP TRIGGER IF EXISTS `virtual_users_after_insert_quota`",
      // The trigger also fires on `INSERT ... ON DUPLICATE KEY UPDATE` paths
      // (MariaDB fires AFTER INSERT regardless of whether the statement ended
      // up inserting or updating the source row). virtual_quota_users.email
      // has no UNIQUE constraint, so `INSERT IGNORE` would not actually
      // ignore anything: every re-run of install.sh or every recreate-after-
      // cascade would stack a fresh quota row. Guarding with a NOT EXISTS
      // subquery makes the trigger truly idempotent without touching the
      // table shape.
      `CREATE TRIGGER \`virtual_users_after_insert_quota\`
       AFTER INSERT ON \`virtual_users\`
       FOR EACH ROW
       BEGIN
         INSERT INTO \`virtual_quota_users\` (\`domain\`, \`email\`, \`bytes\`, \`messages\`)
         SELECT NEW.\`domain\`, NEW.\`email\`, 0, 0
         WHERE NOT EXISTS (SELECT 1 FROM \`virtual_quota_users\` WHERE \`email\` = NEW.\`email\`);
       END`,
      "DROP TRIGGER IF EXISTS `virtual_domains_after_insert_quota`",
      `CREATE TRIGGER \`virtual_domains_after_insert_quota\`
       AFTER INSERT ON \`virtual_domains\`
       FOR EACH ROW
       BEGIN
         INSERT INTO \`virtual_quota_domains\` (\`domain\`, \`bytes\`, \`messages\`)
         SELECT NEW.\`domain\`, 0, 0
         WHERE NOT EXISTS (SELECT 1 FROM \`virtual_quota_domains\` WHERE \`domain\` = NEW.\`domain\`);
       END`,
      "DROP TRIGGER IF EXISTS `virtual_quota_users_after_update_agg`",
      `CREATE TRIGGER \`virtual_quota_users_after_update_agg\`
       AFTER UPDATE ON \`virtual_quota_users\`
       FOR EACH ROW
       BEGIN
         UPDATE \`virtual_quota_domains\`
         SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`virtual_quota_users\` WHERE \`domain\` = NEW.\`domain\`), 0),
             \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`virtual_quota_users\` WHERE \`domain\` = NEW.\`domain\`), 0)
         WHERE \`domain\` = NEW.\`domain\`;
       END`,
      "DROP TRIGGER IF EXISTS `virtual_quota_users_after_insert_agg`",
      `CREATE TRIGGER \`virtual_quota_users_after_insert_agg\`
       AFTER INSERT ON \`virtual_quota_users\`
       FOR EACH ROW
       BEGIN
         UPDATE \`virtual_quota_domains\`
         SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`virtual_quota_users\` WHERE \`domain\` = NEW.\`domain\`), 0),
             \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`virtual_quota_users\` WHERE \`domain\` = NEW.\`domain\`), 0)
         WHERE \`domain\` = NEW.\`domain\`;
       END`,
      "DROP TRIGGER IF EXISTS `virtual_quota_users_after_delete_agg`",
      `CREATE TRIGGER \`virtual_quota_users_after_delete_agg\`
       AFTER DELETE ON \`virtual_quota_users\`
       FOR EACH ROW
       BEGIN
         UPDATE \`virtual_quota_domains\`
         SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`virtual_quota_users\` WHERE \`domain\` = OLD.\`domain\`), 0),
             \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`virtual_quota_users\` WHERE \`domain\` = OLD.\`domain\`), 0)
         WHERE \`domain\` = OLD.\`domain\`;
       END`,
    ];
    for (const sql of stmts) {
      await this.ds.query(sql);
    }
  }
}
