import { Column, Entity, PrimaryColumn } from "typeorm";

export type AppSettingType = "number" | "string";

// Generic key/value settings store: one row per setting, `type_field` says how to
// read `value`. Adding a setting is a new row, never a schema change, which is
// what makes this table reusable for any future server-wide option.
@Entity({ name: "app_settings" })
export class AppSetting {
  @PrimaryColumn({ name: "key", type: "varchar", length: 64 })
  key!: string;

  @Column({ name: "type_field", type: "enum", enum: ["number", "string"] })
  typeField!: AppSettingType;

  @Column({ name: "value", type: "varchar", length: 512, default: "" })
  value!: string;

  @Column({ name: "updated_at", type: "datetime", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
