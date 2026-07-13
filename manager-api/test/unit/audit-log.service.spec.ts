import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuditLogService } from "../../src/core/audit/audit-log.service";

function makeRepo() {
  return { insert: vi.fn().mockResolvedValue(undefined) };
}

describe("AuditLogService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: AuditLogService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new AuditLogService(repo as never);
  });

  it("inserts a full record, stringifying entityId and before/after JSON", async () => {
    await svc.record({
      actorId: "actor-1",
      action: "edit-group-global-permissions",
      entityType: "group",
      entityId: 5,
      before: { a: 1 },
      after: { a: 2 },
    });
    expect(repo.insert).toHaveBeenCalledWith({
      actorId: "actor-1",
      action: "edit-group-global-permissions",
      entityType: "group",
      entityId: "5",
      beforeJson: JSON.stringify({ a: 1 }),
      afterJson: JSON.stringify({ a: 2 }),
    });
  });

  it("nulls entityId and both JSON columns when they are undefined", async () => {
    await svc.record({ actorId: null, action: "delete-group", entityType: "group" });
    expect(repo.insert).toHaveBeenCalledWith({
      actorId: null,
      action: "delete-group",
      entityType: "group",
      entityId: null,
      beforeJson: null,
      afterJson: null,
    });
  });

  it("treats a null entityId as null", async () => {
    await svc.record({ actorId: "a", action: "x", entityType: "t", entityId: null });
    expect(repo.insert.mock.calls[0][0].entityId).toBeNull();
  });

  it("keeps a string entityId and stringifies the numeric zero", async () => {
    await svc.record({ actorId: "a", action: "x", entityType: "t", entityId: "uuid-1" });
    expect(repo.insert.mock.calls[0][0].entityId).toBe("uuid-1");
    await svc.record({ actorId: "a", action: "x", entityType: "t", entityId: 0 });
    expect(repo.insert.mock.calls[1][0].entityId).toBe("0");
  });

  it("records only a before snapshot when after is omitted", async () => {
    await svc.record({ actorId: "a", action: "x", entityType: "t", before: { was: true } });
    const arg = repo.insert.mock.calls[0][0];
    expect(arg.beforeJson).toBe(JSON.stringify({ was: true }));
    expect(arg.afterJson).toBeNull();
  });
});
