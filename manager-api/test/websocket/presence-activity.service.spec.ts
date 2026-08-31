import { describe, it, expect, beforeEach } from "vitest";
import { PresenceActivityService } from "../../src/core/websocket/presence-activity.service";

describe("PresenceActivityService", () => {
  let svc: PresenceActivityService;
  const A = {};
  const B = {};

  beforeEach(() => {
    svc = new PresenceActivityService();
  });

  it("counts a joined socket as active", () => {
    svc.join("u1", A);
    expect(svc.awayUserIds()).toEqual(new Set());
  });

  it("reports a user away when its only socket is idle", () => {
    svc.join("u1", A);
    svc.setActive("u1", A, false);
    expect(svc.awayUserIds()).toEqual(new Set(["u1"]));
  });

  it("keeps a user present while one socket stays active", () => {
    svc.join("u1", A);
    svc.join("u1", B);
    svc.setActive("u1", A, false);
    expect(svc.awayUserIds()).toEqual(new Set());
  });

  it("turns away only when every socket is idle", () => {
    svc.join("u1", A);
    svc.join("u1", B);
    svc.setActive("u1", A, false);
    svc.setActive("u1", B, false);
    expect(svc.awayUserIds()).toEqual(new Set(["u1"]));
  });

  it("drops a user with no socket left, never leaving it away", () => {
    svc.join("u1", A);
    svc.setActive("u1", A, false);
    svc.leave("u1", A);
    expect(svc.awayUserIds()).toEqual(new Set());
  });

  it("ignores activity for a socket it never joined", () => {
    svc.setActive("u1", A, false);
    expect(svc.awayUserIds()).toEqual(new Set());
  });
});
