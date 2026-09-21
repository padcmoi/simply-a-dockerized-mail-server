import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AppSetting } from "../../src/core/entities/app-setting.entity";
import { DmarcSettingsService, baseDomain, serverDomain } from "../../src/core/dmarc/dmarc-settings.service";
import { entity, repoMock } from "../helpers/mocks";

describe("DmarcSettingsService", () => {
  let repo: ReturnType<typeof repoMock<AppSetting>>;
  let svc: DmarcSettingsService;

  beforeEach(() => {
    vi.stubEnv("MAIL_HOSTNAME", "mail.example.org");
    vi.stubEnv("DMARC_REPORT_HOUR", "4");
    repo = repoMock<AppSetting>();
    repo.find.mockResolvedValue([]);
    repo.upsert.mockResolvedValue(undefined);
    svc = new DmarcSettingsService(repo);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to sending off and the hour of the environment", async () => {
    await expect(svc.get()).resolves.toEqual({
      sendingEnabled: false,
      reportHour: 4,
      inboxes: [],
      retentionDays: 90,
    });
  });

  it("falls back to two in the morning when the environment hour is not an hour", async () => {
    vi.stubEnv("DMARC_REPORT_HOUR", "25");
    expect(svc.defaults().reportHour).toBe(2);
    vi.stubEnv("DMARC_REPORT_HOUR", "");
    expect(svc.defaults().reportHour).toBe(2);
  });

  it("reads what was stored, and keeps the defaults for what cannot be read", async () => {
    repo.find.mockResolvedValue([
      entity<AppSetting>({ key: "dmarc_sending_enabled", value: "true" }),
      entity<AppSetting>({ key: "dmarc_report_hour", value: "7" }),
      entity<AppSetting>({ key: "dmarc_inboxes", value: "a@example.org,b@example.org" }),
      entity<AppSetting>({ key: "dmarc_retention_days", value: "-3" }),
    ]);
    await expect(svc.get()).resolves.toEqual({
      sendingEnabled: true,
      reportHour: 7,
      inboxes: ["a@example.org", "b@example.org"],
      retentionDays: 90,
    });
  });

  it("reads an emptied inbox list as no inbox and a stored false as off", async () => {
    repo.find.mockResolvedValue([
      entity<AppSetting>({ key: "dmarc_inboxes", value: "" }),
      entity<AppSetting>({ key: "dmarc_sending_enabled", value: "false" }),
    ]);
    const settings = await svc.get();
    expect(settings.inboxes).toEqual([]);
    expect(settings.sendingEnabled).toBe(false);
  });

  it("writes only the fields it was given, a list as one comma separated value", async () => {
    await svc.update({ sendingEnabled: true, inboxes: ["a@example.org", "b@example.org"], reportHour: 3 });
    expect(repo.upsert).toHaveBeenCalledWith(
      [
        { key: "dmarc_sending_enabled", typeField: "boolean", value: "true" },
        { key: "dmarc_report_hour", typeField: "number", value: "3" },
        { key: "dmarc_inboxes", typeField: "string", value: "a@example.org,b@example.org" },
      ],
      ["key"]
    );
  });

  it("writes nothing when given nothing", async () => {
    await svc.update({});
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});

describe("baseDomain", () => {
  it("drops the host label of a mail host name, never below two labels", () => {
    expect(baseDomain("mail.example.org")).toBe("example.org");
    expect(baseDomain("a.b.example.co.uk.")).toBe("b.example.co.uk");
    expect(baseDomain("example.org")).toBe("example.org");
    expect(baseDomain("localhost")).toBe("localhost");
  });

  it("names the server's own domain after its mail host name", () => {
    vi.stubEnv("MAIL_HOSTNAME", "mail.example.net");
    expect(serverDomain()).toBe("example.net");
    vi.unstubAllEnvs();
  });
});
