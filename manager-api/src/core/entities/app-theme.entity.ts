import { Column, Entity, PrimaryColumn } from "typeorm";
import type { ThemeMode } from "../theme/theme.catalog";

export type AppThemeType = "number" | "string";

// The server-wide interface theme, one row per colour and per mode, on the same
// key/value shape as `app_settings`: a new token is a new row, never a schema
// change.
//
// The table ships empty and stays empty until someone changes something. What is
// missing is not a gap to fill with a seed, it is the interface's own default,
// which the front already holds: a seeded row would be a copy of that default,
// wrong the day it moves and impossible to tell from a deliberate choice.
@Entity({ name: "app_themes" })
export class AppTheme {
  @PrimaryColumn({ name: "key", type: "varchar", length: 64 })
  key!: string;

  @Column({ name: "type_field", type: "enum", enum: ["number", "string"] })
  typeField!: AppThemeType;

  @PrimaryColumn({ name: "mode", type: "enum", enum: ["dark", "light"] })
  mode!: ThemeMode;

  @Column({ name: "value", type: "varchar", length: 512, default: "" })
  value!: string;

  @Column({ name: "updated_at", type: "datetime", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
