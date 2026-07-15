import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger } from "@nestjs/common";

// Path helpers stay real (the whole point is that resolve/relative decide
// safety); only the filesystem effects are mocked.
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  rm: vi.fn(),
  constants: { W_OK: 2 },
}));

import { access, rm } from "fs/promises";
import { MailStorageService } from "../../src/core/mail-storage/mail-storage.service";

const RM_OPTS = { recursive: true, force: true };

vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

describe("MailStorageService", () => {
  let svc: MailStorageService;

  beforeEach(() => {
    process.env.MAIL_VOLUME_PATH = "/var/mail";
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
    svc = new MailStorageService();
  });

  describe("onModuleInit (boot writability check)", () => {
    it("passes when the volume root is writable", async () => {
      await expect(svc.onModuleInit()).resolves.toBeUndefined();
      expect(access).toHaveBeenCalledWith("/var/mail", 2);
    });

    it("crashes with an actionable message on a read-only volume", async () => {
      vi.mocked(access).mockRejectedValueOnce(new Error("EROFS"));
      await expect(svc.onModuleInit()).rejects.toThrow(/is not writable/);
    });
  });

  describe("removeDomain / removeRecipient path safety", () => {
    it("removes a domain tree strictly under vhosts/", async () => {
      await expect(svc.removeDomain("example.com")).resolves.toBe(true);
      expect(rm).toHaveBeenCalledWith("/var/mail/vhosts/example.com", RM_OPTS);
    });

    it("removes a recipient maildir, normalizing the trailing slash", async () => {
      await expect(svc.removeRecipient("example.com/jdoe/", "j@example.com")).resolves.toBe(true);
      expect(rm).toHaveBeenCalledWith("/var/mail/vhosts/example.com/jdoe", RM_OPTS);
    });

    it("refuses a traversal segment (..) without calling rm", async () => {
      await expect(svc.removeDomain("../etc")).resolves.toBe(false);
      expect(rm).not.toHaveBeenCalled();
    });

    it("refuses an absolute path segment without calling rm", async () => {
      await expect(svc.removeDomain("/etc/passwd")).resolves.toBe(false);
      expect(rm).not.toHaveBeenCalled();
    });

    it("refuses an empty segment (the vhosts root itself)", async () => {
      await expect(svc.removeDomain("")).resolves.toBe(false);
      expect(rm).not.toHaveBeenCalled();
    });

    it("refuses a dot segment that resolves to the vhosts root", async () => {
      await expect(svc.removeDomain(".")).resolves.toBe(false);
      expect(rm).not.toHaveBeenCalled();
    });

    it("swallows an rm failure and reports false", async () => {
      vi.mocked(rm).mockRejectedValueOnce(new Error("EBUSY"));
      await expect(svc.removeDomain("example.com")).resolves.toBe(false);
    });

    it("defaults the volume root to /var/mail when MAIL_VOLUME_PATH is unset", async () => {
      delete process.env.MAIL_VOLUME_PATH;
      await expect(svc.removeDomain("example.com")).resolves.toBe(true);
      expect(rm).toHaveBeenCalledWith("/var/mail/vhosts/example.com", RM_OPTS);
    });
  });
});
