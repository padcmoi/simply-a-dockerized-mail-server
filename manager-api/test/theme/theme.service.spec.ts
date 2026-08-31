import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ObjectLiteral } from "typeorm";
import { AccountTheme } from "../../src/core/entities/account-theme.entity";
import { AppTheme } from "../../src/core/entities/app-theme.entity";
import { ThemeService } from "../../src/core/theme/theme.service";
import { repoMock } from "../helpers/mocks";

// A repository double carrying its own entity manager, since a save runs inside
// a transaction: the mocked `transaction` simply hands that manager to the
// callback, so the delete and the insert are observable here.
function makeRepo<T extends ObjectLiteral>() {
  const wipe = { delete: vi.fn(), from: vi.fn(), execute: vi.fn().mockResolvedValue(undefined) };
  wipe.delete.mockReturnValue(wipe);
  wipe.from.mockReturnValue(wipe);
  const manager = {
    delete: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue(undefined),
    createQueryBuilder: vi.fn().mockReturnValue(wipe),
    transaction: vi.fn(),
  };
  manager.transaction.mockImplementation((run: (m: typeof manager) => Promise<void>) => run(manager));
  const repo = Object.assign(repoMock<T>(), { manager });
  repo.find.mockResolvedValue([]);
  return repo;
}

describe("ThemeService", () => {
  let app: ReturnType<typeof makeRepo<AppTheme>>;
  let account: ReturnType<typeof makeRepo<AccountTheme>>;
  let svc: ThemeService;

  beforeEach(() => {
    app = makeRepo<AppTheme>();
    account = makeRepo<AccountTheme>();
    svc = new ThemeService(app, account);
  });

  describe("reading", () => {
    it("sorts the rows into the mode each belongs to", async () => {
      app.find.mockResolvedValue([
        { key: "primary", mode: "light", value: "#2B7FFF" },
        { key: "primary", mode: "dark", value: "#00C950" },
        { key: "--ui-bg", mode: "dark", value: "#0F172B" },
      ]);
      expect(await svc.readApp()).toEqual({
        light: { primary: "#2B7FFF" },
        dark: { primary: "#00C950", "--ui-bg": "#0F172B" },
      });
    });

    // The normal state of a fresh install, and the whole point of shipping no
    // seed: nothing stored means the interface keeps the theme it was built with.
    it("answers an empty theme on an empty table", async () => {
      expect(await svc.readApp()).toEqual({ light: {}, dark: {} });
    });

    // A theme is decoration: a database that cannot be reached must not take the
    // page down with it.
    it("answers an empty theme when the table cannot be read", async () => {
      app.find.mockRejectedValue(new Error("db is away"));
      expect(await svc.readApp()).toEqual({ light: {}, dark: {} });
    });

    it("reads an account's rows scoped to that account", async () => {
      await svc.readAccount("acc-1");
      expect(account.find).toHaveBeenCalledWith({ where: { accountId: "acc-1" } });
    });
  });

  describe("saving", () => {
    it("replaces the whole theme rather than merging into it", async () => {
      await svc.saveApp({ light: { primary: "#2B7FFF" }, dark: {} });
      expect(app.manager.createQueryBuilder().from).toHaveBeenCalledWith(AppTheme);
      expect(app.manager.insert).toHaveBeenCalledWith(AppTheme, [
        { key: "primary", mode: "light", value: "#2B7FFF", typeField: "string" },
      ]);
    });

    // How a reset is written: the rows go, and the fallback takes over. Inserting
    // nothing rather than an empty list keeps the driver out of it.
    it("clears the table and inserts nothing for an empty theme", async () => {
      await svc.saveApp({ light: {}, dark: {} });
      expect(app.manager.createQueryBuilder().from).toHaveBeenCalledWith(AppTheme);
      expect(app.manager.insert).not.toHaveBeenCalled();
    });

    it("stamps every row of an account save with that account", async () => {
      await svc.saveAccount("acc-1", { light: {}, dark: { "--ui-bg": "#0F172B" } });
      expect(account.manager.delete).toHaveBeenCalledWith(AccountTheme, { accountId: "acc-1" });
      expect(account.manager.insert).toHaveBeenCalledWith(AccountTheme, [
        { key: "--ui-bg", mode: "dark", value: "#0F172B", accountId: "acc-1", typeField: "string" },
      ]);
    });

    // Wiping before writing has to be one operation: a save that failed halfway
    // would otherwise leave the interface with no theme at all.
    it("wipes and writes inside a single transaction", async () => {
      await svc.saveApp({ light: { primary: "#2B7FFF" }, dark: {} });
      expect(app.manager.transaction).toHaveBeenCalledTimes(1);
    });

    it("reads the theme back after writing it", async () => {
      app.find.mockResolvedValue([{ key: "primary", mode: "light", value: "#2B7FFF" }]);
      expect(await svc.saveApp({ light: { primary: "#2B7FFF" }, dark: {} })).toEqual({
        light: { primary: "#2B7FFF" },
        dark: {},
      });
    });
  });
});
