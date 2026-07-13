import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { RejectSendersService } from "../../src/api/sieve/reject-senders/reject-senders.service";
import type { SieveRejectSender } from "../../src/core/entities/sieve-reject-sender.entity";

// Minimal in-memory TypeORM repository double: only the methods the service
// touches, each a vi.fn so calls can be asserted.
function makeRepo() {
  return {
    find: vi.fn(),
    findAndCount: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((x: Partial<SieveRejectSender>) => x),
    save: vi.fn((x: Partial<SieveRejectSender>) => Promise.resolve({ id: 1, ...x })),
    remove: vi.fn(),
  };
}

describe("RejectSendersService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: RejectSendersService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new RejectSendersService(repo as never);
  });

  describe("list", () => {
    it("returns the full ordered list when no limit (legacy path)", async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      const res = await svc.list({} as never);
      expect(repo.find).toHaveBeenCalledWith({ order: { sender: "ASC" } });
      expect(res).toEqual([{ id: 1 }]);
    });

    it("paginates, searches and sorts when limit is present", async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);
      const res = await svc.list({ limit: 10, offset: 0, search: "x", sortBy: "sender", sortDir: "asc" } as never);
      expect(res).toEqual({ items: [{ id: 1 }], total: 1 });
      const arg = repo.findAndCount.mock.calls[0][0];
      expect(arg.take).toBe(10);
      expect(arg.order).toEqual({ sender: "ASC" });
    });

    it("falls back to the default sort column on an unknown sortBy", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await svc.list({ limit: 10, offset: 0, sortBy: "bogus", sortDir: "desc" } as never);
      expect(repo.findAndCount.mock.calls[0][0].order).toEqual({ createdAt: "DESC" });
    });
  });

  describe("create", () => {
    it("rejects a duplicate sender with 409", async () => {
      repo.findOne.mockResolvedValue({ id: 1, sender: "a@b.com" });
      await expect(svc.create("a@b.com")).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("saves a new sender enabled", async () => {
      repo.findOne.mockResolvedValue(null);
      await svc.create("a@b.com");
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ sender: "a@b.com", enabled: 1 }));
    });
  });

  describe("toggle", () => {
    it("404 when the row does not exist", async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.toggle(1, true)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("sets enabled to 1 / 0", async () => {
      repo.findOne.mockResolvedValue({ id: 1, enabled: 0 });
      await svc.toggle(1, true);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: 1 }));
    });
  });

  describe("remove", () => {
    it("404 when absent", async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("removes and returns ok", async () => {
      const row = { id: 1 };
      repo.findOne.mockResolvedValue(row);
      const res = await svc.remove(1);
      expect(repo.remove).toHaveBeenCalledWith(row);
      expect(res).toEqual({ ok: true });
    });
  });
});
