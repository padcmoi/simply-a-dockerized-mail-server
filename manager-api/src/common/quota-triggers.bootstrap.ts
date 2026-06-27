import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import type { DataSource } from 'typeorm'

@Injectable()
export class QuotaTriggersBootstrap implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onApplicationBootstrap() {
    const stmts: string[] = [
      'DROP TRIGGER IF EXISTS `VirtualUsers_after_insert_quota`',
      `CREATE TRIGGER \`VirtualUsers_after_insert_quota\`
       AFTER INSERT ON \`VirtualUsers\`
       FOR EACH ROW
       BEGIN
         INSERT IGNORE INTO \`VirtualQuotaUsers\` (\`domain\`, \`email\`, \`bytes\`, \`messages\`)
         VALUES (NEW.\`domain\`, NEW.\`email\`, 0, 0);
       END`,
      'DROP TRIGGER IF EXISTS `VirtualDomains_after_insert_quota`',
      `CREATE TRIGGER \`VirtualDomains_after_insert_quota\`
       AFTER INSERT ON \`VirtualDomains\`
       FOR EACH ROW
       BEGIN
         INSERT IGNORE INTO \`VirtualQuotaDomains\` (\`domain\`, \`bytes\`, \`messages\`)
         VALUES (NEW.\`domain\`, 0, 0);
       END`,
      'DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_update_agg`',
      `CREATE TRIGGER \`VirtualQuotaUsers_after_update_agg\`
       AFTER UPDATE ON \`VirtualQuotaUsers\`
       FOR EACH ROW
       BEGIN
         UPDATE \`VirtualQuotaDomains\`
         SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`VirtualQuotaUsers\` WHERE \`domain\` = NEW.\`domain\`), 0),
             \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`VirtualQuotaUsers\` WHERE \`domain\` = NEW.\`domain\`), 0)
         WHERE \`domain\` = NEW.\`domain\`;
       END`,
      'DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_insert_agg`',
      `CREATE TRIGGER \`VirtualQuotaUsers_after_insert_agg\`
       AFTER INSERT ON \`VirtualQuotaUsers\`
       FOR EACH ROW
       BEGIN
         UPDATE \`VirtualQuotaDomains\`
         SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`VirtualQuotaUsers\` WHERE \`domain\` = NEW.\`domain\`), 0),
             \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`VirtualQuotaUsers\` WHERE \`domain\` = NEW.\`domain\`), 0)
         WHERE \`domain\` = NEW.\`domain\`;
       END`,
      'DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_delete_agg`',
      `CREATE TRIGGER \`VirtualQuotaUsers_after_delete_agg\`
       AFTER DELETE ON \`VirtualQuotaUsers\`
       FOR EACH ROW
       BEGIN
         UPDATE \`VirtualQuotaDomains\`
         SET \`bytes\`    = COALESCE((SELECT SUM(\`bytes\`)    FROM \`VirtualQuotaUsers\` WHERE \`domain\` = OLD.\`domain\`), 0),
             \`messages\` = COALESCE((SELECT SUM(\`messages\`) FROM \`VirtualQuotaUsers\` WHERE \`domain\` = OLD.\`domain\`), 0)
         WHERE \`domain\` = OLD.\`domain\`;
       END`,
    ]
    for (const sql of stmts) {
      await this.ds.query(sql)
    }
  }
}
