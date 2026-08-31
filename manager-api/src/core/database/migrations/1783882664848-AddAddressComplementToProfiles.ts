import type { MigrationInterface, QueryRunner } from "typeorm";

// A second free-form address line (apartment, building, "chez", etc.), right
// after the main address line. Additive and nullable.
export class AddAddressComplementToProfiles1783882664848 implements MigrationInterface {
  name = "AddAddressComplementToProfiles1783882664848";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `account_profiles` ADD COLUMN `address_complement` varchar(255) DEFAULT NULL AFTER `address_line`"
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `account_profiles` DROP COLUMN `address_complement`");
  }
}
