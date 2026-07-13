import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { AntiEscalationService } from "../../src/core/acl/anti-escalation.service";

function makeCpg() {
  return {
    guard: {
      utils: {
        findUnheldPermissions: vi.fn(),
        diffPermissions: vi.fn(),
      },
    },
  };
}

const NONE = { global: [], domain: [] };

describe("AntiEscalationService", () => {
  let cpg: ReturnType<typeof makeCpg>;
  let svc: AntiEscalationService;

  beforeEach(() => {
    cpg = makeCpg();
    svc = new AntiEscalationService(cpg as never);
  });

  describe("assertActingUserHolds", () => {
    it("short-circuits for root without querying the library", async () => {
      await expect(svc.assertActingUserHolds({ id: "r", isRoot: true }, [{ resource: "sieve", action: "access" }], [])).resolves.toBeUndefined();
      expect(cpg.guard.utils.findUnheldPermissions).not.toHaveBeenCalled();
    });

    it("resolves when the actor holds everything requested", async () => {
      cpg.guard.utils.findUnheldPermissions.mockResolvedValue(NONE);
      const global = [{ resource: "sieve", action: "access" }];
      const domain = [{ domainId: 1, resource: "recipients", action: "access" }];
      await expect(svc.assertActingUserHolds({ id: "u", isRoot: false }, global, domain)).resolves.toBeUndefined();
      expect(cpg.guard.utils.findUnheldPermissions).toHaveBeenCalledWith("u", { global, domain });
    });

    it("forbids when a GLOBAL permission is unheld", async () => {
      cpg.guard.utils.findUnheldPermissions.mockResolvedValue({ global: [{ resource: "sieve", action: "access" }], domain: [] });
      await expect(svc.assertActingUserHolds({ id: "u", isRoot: false }, [{ resource: "sieve", action: "access" }], [])).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it("forbids when a DOMAIN permission is unheld", async () => {
      cpg.guard.utils.findUnheldPermissions.mockResolvedValue({ global: [], domain: [{ domainId: 1, resource: "recipients", action: "access" }] });
      await expect(svc.assertActingUserHolds({ id: "u", isRoot: false }, [], [{ domainId: 1, resource: "recipients", action: "access" }])).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it("uses the default message and a custom override", async () => {
      cpg.guard.utils.findUnheldPermissions.mockResolvedValue({ global: [{ resource: "sieve", action: "access" }], domain: [] });
      await expect(svc.assertActingUserHolds({ id: "u", isRoot: false }, [{ resource: "sieve", action: "access" }], [])).rejects.toThrow(
        "Cannot grant a permission you do not hold"
      );
      await expect(
        svc.assertActingUserHolds({ id: "u", isRoot: false }, [{ resource: "sieve", action: "access" }], [], "custom denial")
      ).rejects.toThrow("custom denial");
    });
  });

  describe("assertActingUserCanReplace", () => {
    const before = { global: [{ resource: "sieve", action: "access" }], domain: [] };
    const after = { global: [{ resource: "rspamd", action: "access" }], domain: [] };

    it("checks the symmetric difference (added union removed)", async () => {
      cpg.guard.utils.diffPermissions.mockReturnValue({
        added: { global: [{ resource: "rspamd", action: "access" }], domain: [{ domainId: 2, resource: "aliases", action: "access" }] },
        removed: { global: [{ resource: "sieve", action: "access" }], domain: [] },
      });
      cpg.guard.utils.findUnheldPermissions.mockResolvedValue(NONE);

      await expect(
        svc.assertActingUserCanReplace({ id: "u", isRoot: false }, before.global, after.global, [], [])
      ).resolves.toBeUndefined();

      expect(cpg.guard.utils.diffPermissions).toHaveBeenCalledWith(
        { global: before.global, domain: [] },
        { global: after.global, domain: [] }
      );
      expect(cpg.guard.utils.findUnheldPermissions).toHaveBeenCalledWith("u", {
        global: [{ resource: "rspamd", action: "access" }, { resource: "sieve", action: "access" }],
        domain: [{ domainId: 2, resource: "aliases", action: "access" }],
      });
    });

    it("forbids when the delta contains a permission the actor lacks", async () => {
      cpg.guard.utils.diffPermissions.mockReturnValue({
        added: { global: [{ resource: "superadmin", action: "access" }], domain: [] },
        removed: { global: [], domain: [] },
      });
      cpg.guard.utils.findUnheldPermissions.mockResolvedValue({ global: [{ resource: "superadmin", action: "access" }], domain: [] });
      await expect(svc.assertActingUserCanReplace({ id: "u", isRoot: false }, [], [], [], [])).rejects.toThrow(
        "Cannot grant or revoke a permission you do not hold"
      );
    });

    it("still diffs for root but never queries unheld permissions", async () => {
      cpg.guard.utils.diffPermissions.mockReturnValue({ added: { global: [], domain: [] }, removed: { global: [], domain: [] } });
      await expect(svc.assertActingUserCanReplace({ id: "r", isRoot: true }, [], [], [], [])).resolves.toBeUndefined();
      expect(cpg.guard.utils.diffPermissions).toHaveBeenCalled();
      expect(cpg.guard.utils.findUnheldPermissions).not.toHaveBeenCalled();
    });
  });
});
