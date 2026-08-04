import { describe, it, expect, beforeEach } from "vitest";
import { AppSettingsService, APP_SETTINGS_DEFAULTS } from "../../src/core/settings/app-settings.service";
import type { AppSetting } from "../../src/core/entities/app-setting.entity";
import { entity, repoMock } from "../helpers/mocks";

const row = (key: string, typeField: "number" | "string", value: string) =>
  entity<AppSetting>({ key, typeField, value, updatedAt: new Date(0) });

describe("AppSettingsService", () => {
  let repo: ReturnType<typeof repoMock<AppSetting>>;
  let svc: AppSettingsService;

  beforeEach(() => {
    repo = repoMock<AppSetting>();
    svc = new AppSettingsService(repo);
  });

  it("serves the defaults when no rows exist", async () => {
    repo.find.mockResolvedValue([]);
    await svc.onModuleInit();
    expect(svc.get()).toEqual(APP_SETTINGS_DEFAULTS);
  });

  it("reads each key with its declared type and caches it synchronously", async () => {
    repo.find.mockResolvedValue([
      row("offline_notify_after_ms", "number", "60000"),
      row("offline_sweep_interval_ms", "number", "15000"),
      row("mail_min_interval_ms", "number", "5000"),
      row("supervision_retention_ms", "number", "604800000"),
      row("manager_url", "string", "https://mgr.test"),
    ]);
    await svc.reload();
    expect(svc.get()).toEqual({
      offlineNotifyAfterMs: 60000,
      offlineSweepIntervalMs: 15000,
      mailMinIntervalMs: 5000,
      supervisionRetentionMs: 604800000,
      managerUrl: "https://mgr.test",
    });
  });

  it("falls back to the default for a missing key", async () => {
    repo.find.mockResolvedValue([row("manager_url", "string", "https://mgr.test")]);
    await svc.reload();
    expect(svc.get()).toEqual({ ...APP_SETTINGS_DEFAULTS, managerUrl: "https://mgr.test" });
  });

  it("keeps the default when a numeric value is unparseable", async () => {
    repo.find.mockResolvedValue([row("offline_notify_after_ms", "number", "oops")]);
    await svc.reload();
    expect(svc.get().offlineNotifyAfterMs).toBe(APP_SETTINGS_DEFAULTS.offlineNotifyAfterMs);
  });

  it("upserts only the provided keys, typed, then refreshes the cache", async () => {
    repo.find.mockResolvedValue([]);
    await svc.update({ offlineNotifyAfterMs: 60000, managerUrl: "https://mgr.test" });
    expect(repo.upsert).toHaveBeenCalledWith(
      [
        { key: "offline_notify_after_ms", typeField: "number", value: "60000" },
        { key: "manager_url", typeField: "string", value: "https://mgr.test" },
      ],
      ["key"]
    );
  });

  it("writes no row when update has nothing to change", async () => {
    repo.find.mockResolvedValue([]);
    await svc.update({});
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
