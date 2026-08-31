import { describe, it, expect, beforeEach } from "vitest";
import type { Repository } from "typeorm";
import { MailSettingsService } from "../../src/core/mailer/mail-settings.service";
import { MailSetting } from "../../src/core/entities/mail-setting.entity";
import { entity, repoMock, type Loose } from "../helpers/mocks";

function makeRow(partial: Partial<MailSetting>): MailSetting {
  return entity<MailSetting>({
    provider: "brevo",
    host: null,
    port: null,
    secure: 0,
    username: null,
    password: null,
    fromAddress: null,
    selected: null,
    validated: 0,
    otp: null,
    updatedAt: new Date(0),
    ...partial,
  });
}

describe("MailSettingsService", () => {
  let repo: Loose<Repository<MailSetting>>;
  let svc: MailSettingsService;

  beforeEach(() => {
    repo = repoMock<MailSetting>();
    repo.update.mockResolvedValue(undefined);
    repo.save.mockImplementation(async (x: object) => x);
    svc = new MailSettingsService(repo);
  });

  describe("list", () => {
    it("returns every config masked with its validated flag, plus the selected provider", async () => {
      repo.find.mockResolvedValue([
        makeRow({ provider: "brevo", username: "u", password: "s3cret", selected: 1, validated: 1 }),
        makeRow({ provider: "smtp", host: "mail-postfix", validated: 1 }),
      ]);
      const out = await svc.list();
      expect(out.selected).toBe("brevo");
      expect(out.configs).toEqual([
        { provider: "brevo", host: null, port: null, secure: false, username: "u", fromAddress: null, hasPassword: true, validated: true },
        { provider: "smtp", host: "mail-postfix", port: null, secure: false, username: null, fromAddress: null, hasPassword: false, validated: true },
      ]);
    });

    it("selected is null when nothing is active", async () => {
      repo.find.mockResolvedValue([makeRow({ provider: "smtp", host: "h", validated: 1 })]);
      expect((await svc.list()).selected).toBeNull();
    });
  });

  describe("save upserts one provider and resets only its validation + selection", () => {
    it("creates the row when the provider has none yet", async () => {
      repo.findOne.mockResolvedValue(null);
      const created = makeRow({ provider: "smtp" });
      repo.create.mockReturnValue(created);
      await svc.save({ provider: "smtp", host: "smtp.example.com", port: 587 });
      expect(repo.create).toHaveBeenCalledWith({ provider: "smtp" });
      expect(created.host).toBe("smtp.example.com");
      expect(repo.save).toHaveBeenCalledWith(created);
    });

    it("write-only password: keeps stored, overwrites, clears on empty", async () => {
      const row = makeRow({ provider: "brevo", password: "old" });
      repo.findOne.mockResolvedValue(row);
      await svc.save({ provider: "brevo", username: "u" });
      expect(row.password).toBe("old");
      await svc.save({ provider: "brevo", password: "new" });
      expect(row.password).toBe("new");
      await svc.save({ provider: "brevo", password: "" });
      expect(row.password).toBeNull();
    });

    it("resets validated and selected for the saved provider (must re-validate)", async () => {
      const row = makeRow({ provider: "brevo", validated: 1, selected: 1 });
      repo.findOne.mockResolvedValue(row);
      await svc.save({ provider: "brevo", username: "u", fromAddress: "a@b.test" });
      expect(row.validated).toBe(0);
      expect(row.selected).toBeNull();
    });
  });

  describe("verify validates AND activates the provider", () => {
    it("rejects a wrong or missing code", async () => {
      repo.findOne.mockResolvedValue(makeRow({ provider: "brevo", otp: "123456" }));
      expect(await svc.verify("brevo", "000000")).toBe(false);
      repo.findOne.mockResolvedValue(makeRow({ provider: "brevo", otp: null }));
      expect(await svc.verify("brevo", "123456")).toBe(false);
    });

    it("on the right code: clears old selection, sets validated + selected, clears otp", async () => {
      repo.findOne.mockResolvedValue(makeRow({ provider: "brevo", otp: "123456" }));
      expect(await svc.verify("brevo", "123456")).toBe(true);
      expect(repo.update).toHaveBeenCalledWith({ selected: 1 }, { selected: null });
      expect(repo.update).toHaveBeenCalledWith({ provider: "brevo" }, { validated: 1, selected: 1, otp: null });
    });
  });

  describe("select activates an already-validated provider without a code", () => {
    it("selects a validated provider, clearing the previous one", async () => {
      repo.findOne.mockResolvedValue(makeRow({ provider: "smtp", validated: 1 }));
      expect(await svc.select("smtp")).toBe(true);
      expect(repo.update).toHaveBeenCalledWith({ selected: 1 }, { selected: null });
      expect(repo.update).toHaveBeenCalledWith({ provider: "smtp" }, { selected: 1 });
    });

    it("refuses to select a provider that is not validated", async () => {
      repo.findOne.mockResolvedValue(makeRow({ provider: "smtp", validated: 0 }));
      expect(await svc.select("smtp")).toBe(false);
    });
  });

  describe("disable clears the active selection, keeping validations", () => {
    it("updates WHERE selected = 1 to null", async () => {
      await svc.disable();
      expect(repo.update).toHaveBeenCalledWith({ selected: 1 }, { selected: null });
    });
  });

  describe("setOtp / toConfig / isEnabled", () => {
    it("stores a code on a provider row", async () => {
      await svc.setOtp("brevo", "654321");
      expect(repo.update).toHaveBeenCalledWith({ provider: "brevo" }, { otp: "654321" });
    });

    it("resolves the config from the selected row, enabled when configured", async () => {
      repo.findOne.mockResolvedValue(makeRow({ provider: "smtp", host: "mail-postfix", selected: 1, validated: 1 }));
      expect(await svc.isEnabled()).toBe(true);
      expect((await svc.toConfig()).provider).toBe("smtp");
    });

    it("is disabled (off) when no row is selected", async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await svc.isEnabled()).toBe(false);
    });
  });
});
