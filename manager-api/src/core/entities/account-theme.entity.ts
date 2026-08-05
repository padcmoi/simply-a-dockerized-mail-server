import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import type { ThemeMode } from "../theme/theme.catalog";
import { Account } from "./account.entity";

export type AccountThemeType = "number" | "string";

// One account's own theme, read at login and laid over the server-wide one. Same
// shape as `app_themes` with the account in front of the key, and it cascades
// away with the account: a colour is not a thing that outlives the person who
// chose it.
@Entity({ name: "account_themes" })
export class AccountTheme {
  @PrimaryColumn({ name: "account_id", type: "char", length: 36 })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  @PrimaryColumn({ name: "key", type: "varchar", length: 64 })
  key!: string;

  @Column({ name: "type_field", type: "enum", enum: ["number", "string"] })
  typeField!: AccountThemeType;

  @PrimaryColumn({ name: "mode", type: "enum", enum: ["dark", "light"] })
  mode!: ThemeMode;

  @Column({ name: "value", type: "varchar", length: 512, default: "" })
  value!: string;

  @Column({ name: "updated_at", type: "datetime", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
