import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AccountTheme } from "../entities/account-theme.entity";
import { AppTheme } from "../entities/app-theme.entity";
import { THEME_MODES, ThemeView, emptyTheme } from "./theme.catalog";

type ThemeRow = { key: string; mode: string; value: string };

function toView(rows: ThemeRow[]): ThemeView {
  const view = emptyTheme();
  for (const row of rows) {
    if (row.mode === "light" || row.mode === "dark") view[row.mode][row.key] = row.value;
  }
  return view;
}

@Injectable()
export class ThemeService {
  constructor(
    @InjectRepository(AppTheme) private readonly app: Repository<AppTheme>,
    @InjectRepository(AccountTheme) private readonly account: Repository<AccountTheme>
  ) {}

  // An unreachable or empty table is not an error: it means the interface keeps
  // the theme it ships with, which is exactly what a fresh install wants.
  async readApp(): Promise<ThemeView> {
    const rows = await this.app.find().catch(() => [] as AppTheme[]);
    return toView(rows);
  }

  async readAccount(accountId: string): Promise<ThemeView> {
    const rows = await this.account.find({ where: { accountId } }).catch(() => [] as AccountTheme[]);
    return toView(rows);
  }

  // A save replaces the whole theme rather than merging into it, so a colour put
  // back to its default disappears from the table instead of lingering as a row
  // that says "the default, written down". Emptied entirely, the scope falls
  // back to what the interface ships with, no seed to undo.
  async saveApp(view: ThemeView): Promise<ThemeView> {
    await this.app.manager.transaction(async (manager) => {
      // Through the query builder rather than `delete({})`: TypeORM refuses an
      // empty criteria, and rightly so everywhere except here, where wiping the
      // table is the whole intent.
      await manager.createQueryBuilder().delete().from(AppTheme).execute();
      const rows = this.rowsOf(view).map((row) => ({ ...row, typeField: "string" as const }));
      if (rows.length) await manager.insert(AppTheme, rows);
    });
    return this.readApp();
  }

  async saveAccount(accountId: string, view: ThemeView): Promise<ThemeView> {
    await this.account.manager.transaction(async (manager) => {
      await manager.delete(AccountTheme, { accountId });
      const rows = this.rowsOf(view).map((row) => ({ ...row, accountId, typeField: "string" as const }));
      if (rows.length) await manager.insert(AccountTheme, rows);
    });
    return this.readAccount(accountId);
  }

  private rowsOf(view: ThemeView) {
    return THEME_MODES.flatMap((mode) => Object.entries(view[mode] ?? {}).map(([key, value]) => ({ key, mode, value })));
  }
}
