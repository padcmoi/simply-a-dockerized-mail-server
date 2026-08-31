import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { MySpaceService } from "../../src/api/my-space/my-space.service";
import { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import type { RecipientsService } from "../../src/api/domains/recipients/recipients.service";
import type { AliasesService } from "../../src/api/domains/aliases/aliases.service";
import type { DelegationsService } from "../../src/api/domains/delegations/delegations.service";
import { providerMock, repoMock } from "../helpers/mocks";

function makeMocks() {
  return {
    recipients: repoMock<VirtualUser>(),
    aliases: repoMock<VirtualAlias>(),
    recipientsSvc: providerMock<RecipientsService>({
      getWithUsage: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      create: vi.fn(),
      resolveDomain: vi.fn(),
    }),
    aliasesSvc: providerMock<AliasesService>({ update: vi.fn(), remove: vi.fn(), create: vi.fn(), resolveDomain: vi.fn() }),
    delegationsSvc: providerMock<DelegationsService>({
      myDelegations: vi.fn(),
      assertCanCreateRecipient: vi.fn(),
      assertCanCreateAlias: vi.fn(),
      assertCanRaiseQuota: vi.fn(),
    }),
  };
}

describe("MySpaceService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: MySpaceService;

  beforeEach(() => {
    m = makeMocks();
    svc = new MySpaceService(m.recipients, m.aliases, m.recipientsSvc, m.aliasesSvc, m.delegationsSvc);
  });

  describe("getRecipient", () => {
    it("throws NotFound when the caller does not own the recipient", async () => {
      m.recipients.findOne.mockResolvedValue(null);
      await expect(svc.getRecipient("u1", 5)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("scopes the lookup to the owner and returns only owner-facing fields, never the password hash", async () => {
      m.recipients.findOne.mockResolvedValue({ id: 5, domain: "ex.com", ownerId: "u1" });
      m.recipientsSvc.getWithUsage.mockResolvedValue({
        id: 5,
        email: "a@ex.com",
        domain: "ex.com",
        quota: "1048576",
        usedBytes: "512",
        active: 1,
        password: "HASH",
        maildir: "ex.com/a/",
        ownerEmail: "u1@x.io",
      });

      const res = await svc.getRecipient("u1", 5);

      expect(m.recipients.findOne).toHaveBeenCalledWith({ where: { id: 5, ownerId: "u1" } });
      expect(m.recipientsSvc.getWithUsage).toHaveBeenCalledWith(5, "ex.com");
      expect(res).toEqual({ id: 5, email: "a@ex.com", domain: "ex.com", quota: "1048576", usedBytes: "512", active: true });
    });
  });

  describe("updateRecipient", () => {
    it("throws NotFound and never mutates when the caller does not own the recipient", async () => {
      m.recipients.findOne.mockResolvedValue(null);
      await expect(svc.updateRecipient("u1", 5, { active: false })).rejects.toBeInstanceOf(NotFoundException);
      expect(m.recipientsSvc.update).not.toHaveBeenCalled();
    });

    it("delegates the mutation to RecipientsService against the owned domain and returns the mapped view", async () => {
      m.recipients.findOne.mockResolvedValue({ id: 5, domain: "ex.com", ownerId: "u1" });
      m.recipientsSvc.getWithUsage.mockResolvedValue({
        id: 5,
        email: "a@ex.com",
        domain: "ex.com",
        quota: "1048576",
        usedBytes: "0",
        active: 0,
        password: "HASH",
      });

      const res = await svc.updateRecipient("u1", 5, { password: "supersecret", active: false });

      expect(m.recipientsSvc.update).toHaveBeenCalledWith(5, { password: "supersecret", active: false }, "ex.com", {
        skipDomainQuota: false,
      });
      expect(res).toEqual({ id: 5, email: "a@ex.com", domain: "ex.com", quota: "1048576", usedBytes: "0", active: false });
    });

    it("a quota change spends the delegated budget and skips the domain-level check", async () => {
      m.recipients.findOne.mockResolvedValue({ id: 5, domain: "ex.com", ownerId: "u1", quota: "1048576" });
      m.recipientsSvc.getWithUsage.mockResolvedValue({
        id: 5,
        email: "a@ex.com",
        domain: "ex.com",
        quota: "10485760",
        usedBytes: "0",
        active: 1,
        password: "HASH",
      });

      await svc.updateRecipient("u1", 5, { quota: 10485760 });

      expect(m.delegationsSvc.assertCanRaiseQuota).toHaveBeenCalledWith("u1", "ex.com", 10485760 - 1048576);
      expect(m.recipientsSvc.update).toHaveBeenCalledWith(5, { quota: 10485760 }, "ex.com", { skipDomainQuota: true });
    });

    it("refuses the quota change when the delegation refuses it, without mutating", async () => {
      m.recipients.findOne.mockResolvedValue({ id: 5, domain: "ex.com", ownerId: "u1", quota: "1048576" });
      m.delegationsSvc.assertCanRaiseQuota.mockRejectedValueOnce(new Error("reserveExceeded"));
      await expect(svc.updateRecipient("u1", 5, { quota: 999999999 })).rejects.toThrow("reserveExceeded");
      expect(m.recipientsSvc.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteRecipient", () => {
    it("throws NotFound and never deletes when the caller does not own the recipient", async () => {
      m.recipients.findOne.mockResolvedValue(null);
      await expect(svc.deleteRecipient("u1", 5)).rejects.toBeInstanceOf(NotFoundException);
      expect(m.recipientsSvc.remove).not.toHaveBeenCalled();
    });

    it("delegates the deletion to RecipientsService against the owned domain", async () => {
      m.recipients.findOne.mockResolvedValue({ id: 5, domain: "ex.com", ownerId: "u1" });
      m.recipientsSvc.remove.mockResolvedValue({ ok: true });

      const res = await svc.deleteRecipient("u1", 5);

      expect(m.recipients.findOne).toHaveBeenCalledWith({ where: { id: 5, ownerId: "u1" } });
      expect(m.recipientsSvc.remove).toHaveBeenCalledWith(5, "ex.com");
      expect(res).toEqual({ ok: true });
    });
  });

  describe("getAlias", () => {
    it("throws NotFound when the caller does not own the alias", async () => {
      m.aliases.findOne.mockResolvedValue(null);
      await expect(svc.getAlias("u1", 7)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("scopes the lookup to the owner and returns the alias fields", async () => {
      m.aliases.findOne.mockResolvedValue({
        id: 7,
        source: "a@ex.com",
        destination: "b@ex.com",
        domain: "ex.com",
        ownerId: "u1",
      });

      const res = await svc.getAlias("u1", 7);

      expect(m.aliases.findOne).toHaveBeenCalledWith({ where: { id: 7, ownerId: "u1" } });
      expect(res).toEqual({ id: 7, source: "a@ex.com", destination: "b@ex.com", domain: "ex.com" });
    });
  });

  describe("updateAlias", () => {
    it("throws NotFound and never mutates when the caller does not own the alias", async () => {
      m.aliases.findOne.mockResolvedValue(null);
      await expect(svc.updateAlias("u1", 7, { destination: "c@ex.com" })).rejects.toBeInstanceOf(NotFoundException);
      expect(m.aliasesSvc.update).not.toHaveBeenCalled();
    });

    it("delegates only the destination to AliasesService against the owned domain", async () => {
      m.aliases.findOne.mockResolvedValue({
        id: 7,
        source: "a@ex.com",
        destination: "b@ex.com",
        domain: "ex.com",
        ownerId: "u1",
      });

      const res = await svc.updateAlias("u1", 7, { destination: "c@ex.com" });

      expect(m.aliasesSvc.update).toHaveBeenCalledWith(7, { destination: "c@ex.com" }, "ex.com");
      expect(res).toEqual({ id: 7, source: "a@ex.com", destination: "b@ex.com", domain: "ex.com" });
    });
  });

  describe("delegated self-service", () => {
    it("myDelegations passes the caller through", async () => {
      m.delegationsSvc.myDelegations.mockResolvedValue([{ domainId: 1 }]);
      await expect(svc.myDelegations("u1")).resolves.toEqual([{ domainId: 1 }]);
      expect(m.delegationsSvc.myDelegations).toHaveBeenCalledWith("u1");
    });

    it("createRecipient checks the delegation then creates an owned mailbox outside the domain-level check", async () => {
      m.recipientsSvc.resolveDomain.mockResolvedValue("ex.com");
      m.recipientsSvc.create.mockResolvedValue({ id: 42 });
      m.recipients.findOne.mockResolvedValue({ id: 42, domain: "ex.com", ownerId: "u1" });
      m.recipientsSvc.getWithUsage.mockResolvedValue({
        id: 42,
        email: "j@ex.com",
        domain: "ex.com",
        quota: "1048576",
        usedBytes: "0",
        active: 1,
      });
      const dto = { localPart: "j", password: "correcthorse", quota: 1048576 };
      await svc.createRecipient("u1", 1, dto);
      expect(m.delegationsSvc.assertCanCreateRecipient).toHaveBeenCalledWith("u1", 1, 1048576);
      expect(m.recipientsSvc.create).toHaveBeenCalledWith(dto, "ex.com", { ownerId: "u1", skipDomainQuota: true });
    });

    it("createRecipient never creates when the delegation check throws", async () => {
      m.recipientsSvc.resolveDomain.mockResolvedValue("ex.com");
      m.delegationsSvc.assertCanCreateRecipient.mockRejectedValue(new Error("cap"));
      await expect(svc.createRecipient("u1", 1, { localPart: "j", password: "correcthorse", quota: 1048576 })).rejects.toThrow();
      expect(m.recipientsSvc.create).not.toHaveBeenCalled();
    });

    it("createAlias checks the delegation then creates an owned alias", async () => {
      m.aliasesSvc.resolveDomain.mockResolvedValue("ex.com");
      m.aliasesSvc.create.mockResolvedValue({ id: 43 });
      m.aliases.findOne.mockResolvedValue({ id: 43, source: "j@ex.com", destination: "d@ex.com", domain: "ex.com", ownerId: "u1" });
      const dto = { localPart: "j", destination: "d@ex.com" };
      await svc.createAlias("u1", 1, dto);
      expect(m.delegationsSvc.assertCanCreateAlias).toHaveBeenCalledWith("u1", 1);
      expect(m.aliasesSvc.create).toHaveBeenCalledWith(dto, "ex.com", { ownerId: "u1" });
    });
  });

  describe("deleteAlias", () => {
    it("throws NotFound and never deletes when the caller does not own the alias", async () => {
      m.aliases.findOne.mockResolvedValue(null);
      await expect(svc.deleteAlias("u1", 7)).rejects.toBeInstanceOf(NotFoundException);
      expect(m.aliasesSvc.remove).not.toHaveBeenCalled();
    });

    it("delegates the deletion to AliasesService against the owned domain", async () => {
      m.aliases.findOne.mockResolvedValue({ id: 7, domain: "ex.com", ownerId: "u1" });
      m.aliasesSvc.remove.mockResolvedValue({ ok: true });

      const res = await svc.deleteAlias("u1", 7);

      expect(m.aliases.findOne).toHaveBeenCalledWith({ where: { id: 7, ownerId: "u1" } });
      expect(m.aliasesSvc.remove).toHaveBeenCalledWith(7, "ex.com");
      expect(res).toEqual({ ok: true });
    });
  });
});
