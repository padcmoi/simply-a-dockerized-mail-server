import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import type { Repository } from "typeorm";
import { ApiError } from "../../src/core/common/api-error";
import type { Account } from "../../src/core/entities/account.entity";
import type { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import type { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import type { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { ProtectionService } from "../../src/core/protection/protection.service";
import { providerMock } from "../helpers/mocks";

describe("ProtectionService", () => {
  const accounts = { findOne: vi.fn(), update: vi.fn() };
  const recipients = { findOne: vi.fn(), update: vi.fn(), count: vi.fn() };
  const aliases = { findOne: vi.fn(), update: vi.fn(), count: vi.fn() };
  const domains = { findOne: vi.fn(), update: vi.fn() };
  let svc: ProtectionService;

  beforeEach(() => {
    for (const mock of [accounts, recipients, aliases, domains]) for (const fn of Object.values(mock)) fn.mockReset();
    svc = new ProtectionService(
      providerMock<Repository<Account>>(accounts),
      providerMock<Repository<VirtualUser>>(recipients),
      providerMock<Repository<VirtualAlias>>(aliases),
      providerMock<Repository<VirtualDomain>>(domains)
    );
  });

  it("reads the flag on the row of the resource's own table", async () => {
    recipients.findOne.mockResolvedValue({ email: "j@d.test", isProtected: 1 });
    expect(await svc.isProtected("recipient", 41)).toBe(true);
    expect(recipients.findOne).toHaveBeenCalledWith({ select: { email: true, isProtected: true }, where: { id: 41 } });
  });

  it("treats a missing row and a clear flag as unprotected", async () => {
    aliases.findOne.mockResolvedValue(null);
    expect(await svc.isProtected("alias", 7)).toBe(false);
    domains.findOne.mockResolvedValue({ domain: "d.test", isProtected: 0 });
    expect(await svc.isProtected("domain", 1)).toBe(false);
  });

  it("refuses a protected resource with a 403 protection.locked", async () => {
    accounts.findOne.mockResolvedValue({ email: "a@x.test", isProtected: 1 });
    const e = await svc.assertUnprotected("account", "uuid").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).getStatus()).toBe(403);
    expect((e as ApiError).getResponse()).toMatchObject({ code: "protection.locked", params: { type: "account" } });
  });

  it("refuses to remove a protected domain", async () => {
    domains.findOne.mockResolvedValue({ domain: "d.test", isProtected: 1 });
    const e = await svc.assertDomainRemovable(1).catch((x: unknown) => x);
    expect((e as ApiError).getResponse()).toMatchObject({ code: "protection.locked" });
  });

  it("refuses to remove a domain holding a protected mailbox or alias", async () => {
    domains.findOne.mockResolvedValue({ domain: "d.test", isProtected: 0 });
    recipients.count.mockResolvedValue(1);
    aliases.count.mockResolvedValue(1);
    const e = await svc.assertDomainRemovable(1).catch((x: unknown) => x);
    expect((e as ApiError).getResponse()).toMatchObject({ code: "protection.domainHoldsProtected", params: { count: 2 } });
    expect(recipients.count).toHaveBeenCalledWith({ where: { domain: "d.test", isProtected: 1 } });
  });

  it("lets an unprotected domain holding nothing protected be removed", async () => {
    domains.findOne.mockResolvedValue({ domain: "d.test", isProtected: 0 });
    recipients.count.mockResolvedValue(0);
    aliases.count.mockResolvedValue(0);
    await expect(svc.assertDomainRemovable(1)).resolves.toBeUndefined();
  });

  it("sets and clears the flag in the right table, returning the label", async () => {
    recipients.findOne.mockResolvedValue({ email: "j@d.test", isProtected: 0 });
    expect(await svc.setProtected("recipient", "41", true)).toBe("j@d.test");
    expect(recipients.update).toHaveBeenCalledWith({ id: 41 }, { isProtected: 1 });

    accounts.findOne.mockResolvedValue({ email: "a@x.test", isProtected: 1 });
    expect(await svc.setProtected("account", "uuid", false)).toBe("a@x.test");
    expect(accounts.update).toHaveBeenCalledWith({ id: "uuid" }, { isProtected: 0 });

    aliases.findOne.mockResolvedValue({ source: "s@d.test", isProtected: 0 });
    await svc.setProtected("alias", "7", true);
    expect(aliases.update).toHaveBeenCalledWith({ id: 7 }, { isProtected: 1 });

    domains.findOne.mockResolvedValue({ domain: "d.test", isProtected: 0 });
    await svc.setProtected("domain", "1", true);
    expect(domains.update).toHaveBeenCalledWith({ id: 1 }, { isProtected: 1 });
  });

  it("404s on a resource that does not exist, writing nothing", async () => {
    aliases.findOne.mockResolvedValue(null);
    await expect(svc.setProtected("alias", "999", true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.setProtected("domain", "abc", true)).rejects.toBeInstanceOf(NotFoundException);
    expect(aliases.update).not.toHaveBeenCalled();
    expect(domains.update).not.toHaveBeenCalled();
  });
});
