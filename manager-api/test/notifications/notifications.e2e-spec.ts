import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { NotificationsController } from "../../src/api/notifications/notifications.controller";
import { NotificationsService } from "../../src/core/notifications/notifications.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/notifications";

type Method = "get" | "post" | "put" | "delete";

type EffectiveMock = { getEffectivePermissions: ReturnType<typeof vi.fn> };
const effective = (h: Harness) => h.cpg.guard as typeof h.cpg.guard & EffectiveMock;
const CLAMAV_STATUS = [
  { resource: "clamav", action: "access" },
  { resource: "clamav", action: "view-clamav-status" },
];
const OFF = { inApp: false, email: false };
const PREFERENCES = { support: { inApp: true, email: true }, supervision: OFF, "clamav-stale": OFF, "clamav-unreachable": OFF };

describe("NotificationsController (e2e: auth + ownership)", () => {
  let h: Harness;
  const svc = {
    list: vi.fn(),
    feed: vi.fn(),
    preferencesFor: vi.fn(),
    setPreference: vi.fn(),
    channelsFor: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    markUnread: vi.fn(),
    purge: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    for (const fn of Object.values(svc)) fn.mockReset().mockResolvedValue({ unread: 0, items: [] });
    svc.preferencesFor.mockResolvedValue(PREFERENCES);
    svc.setPreference.mockResolvedValue(PREFERENCES);
    svc.channelsFor.mockResolvedValue(OFF);
    effective(h).getEffectivePermissions = vi.fn().mockResolvedValue({ global: [] });
  });

  const api = () => request(h.app.getHttpServer());
  const user = () => `Bearer ${h.token(USER)}`;
  const call = (m: Method, path: string) => {
    const agent = api();
    if (m === "get") return agent.get(path);
    if (m === "post") return agent.post(path);
    if (m === "put") return agent.put(path);
    return agent.delete(path);
  };

  const routes: { name: string; method: Method; path: string }[] = [
    { name: "GET list", method: "get", path: base },
    { name: "GET feed", method: "get", path: `${base}/feed` },
    { name: "GET preferences", method: "get", path: `${base}/preferences` },
    { name: "PUT preferences", method: "put", path: `${base}/preferences` },
    { name: "POST read-all", method: "post", path: `${base}/read-all` },
    { name: "POST :id/read", method: "post", path: `${base}/9/read` },
    { name: "POST :id/unread", method: "post", path: `${base}/9/unread` },
    { name: "DELETE purge", method: "delete", path: base },
    { name: "DELETE :id", method: "delete", path: `${base}/9` },
  ];

  describe("auth (401)", () => {
    for (const r of routes) {
      it(`401 without a token -- ${r.name}`, async () => {
        await call(r.method, r.path).expect(401);
      });
      it(`401 with a garbage bearer token -- ${r.name}`, async () => {
        await call(r.method, r.path).set("Authorization", "Bearer nope").expect(401);
      });
    }
  });

  // Self-scoped by design: these routes carry no ACL, every authenticated
  // account reaches them, and the service only ever sees its own id.
  describe("no ACL, but strictly scoped to the caller", () => {
    it("lets a permissionless account read its own feed", async () => {
      await call("get", `${base}/feed`).set("Authorization", user()).expect(200);
      expect(svc.feed).toHaveBeenCalledWith(USER.id);
    });

    it("passes the caller id, never a client-supplied one", async () => {
      await api().get(`${base}?accountId=${ROOT.id}`).set("Authorization", user()).expect(200);
      expect(svc.list).toHaveBeenCalledWith(USER.id, expect.anything());
    });

    it("scopes a single read to the caller", async () => {
      await call("post", `${base}/9/read`).set("Authorization", user()).expect(201);
      expect(svc.markRead).toHaveBeenCalledWith(USER.id, 9);
    });

    it("scopes read-all to the caller", async () => {
      await call("post", `${base}/read-all`).set("Authorization", user()).expect(201);
      expect(svc.markAllRead).toHaveBeenCalledWith(USER.id);
    });

    it("scopes a single unread to the caller", async () => {
      await call("post", `${base}/9/unread`).set("Authorization", user()).expect(201);
      expect(svc.markUnread).toHaveBeenCalledWith(USER.id, 9);
    });

    it("purges the caller's own history, the read rows by default", async () => {
      await call("delete", base).set("Authorization", user()).expect(200);
      expect(svc.purge).toHaveBeenCalledWith(USER.id, "read");
    });

    it("purges everything only when the scope says so", async () => {
      await api().delete(`${base}?scope=all`).set("Authorization", user()).expect(200);
      expect(svc.purge).toHaveBeenCalledWith(USER.id, "all");
    });

    it("scopes a delete to the caller", async () => {
      await call("delete", `${base}/9`).set("Authorization", user()).expect(200);
      expect(svc.remove).toHaveBeenCalledWith(USER.id, 9);
    });

    it("scopes the preference write to the caller", async () => {
      await api()
        .put(`${base}/preferences`)
        .set("Authorization", user())
        .send({ source: "support", inApp: false, email: true })
        .expect(200);
      expect(svc.setPreference).toHaveBeenCalledWith(USER.id, "support", { inApp: false, email: true });
    });
  });

  describe("sources gated by a permission", () => {
    const put = (body: Record<string, unknown>) => api().put(`${base}/preferences`).set("Authorization", user()).send(body);

    it("reports the antivirus sources as not allowed without the antivirus permissions", async () => {
      const res = await call("get", `${base}/preferences`).set("Authorization", user()).expect(200);
      expect(res.body["clamav-stale"]).toEqual({ ...OFF, allowed: false });
      expect(res.body["clamav-unreachable"]).toEqual({ ...OFF, allowed: false });
      expect(res.body.support).toEqual({ inApp: true, email: true, allowed: true });
    });

    it("reports them as allowed once both permissions are held", async () => {
      effective(h).getEffectivePermissions.mockResolvedValue({ global: CLAMAV_STATUS });
      const res = await call("get", `${base}/preferences`).set("Authorization", user()).expect(200);
      expect(res.body["clamav-stale"].allowed).toBe(true);
      expect(res.body["clamav-unreachable"].allowed).toBe(true);
    });

    it("reports them as not allowed when only one of the two permissions is held", async () => {
      effective(h).getEffectivePermissions.mockResolvedValue({ global: [CLAMAV_STATUS[0]] });
      const res = await call("get", `${base}/preferences`).set("Authorization", user()).expect(200);
      expect(res.body["clamav-stale"].allowed).toBe(false);
    });

    it("lets root turn them on without asking the permission library", async () => {
      await api()
        .put(`${base}/preferences`)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ source: "clamav-stale", inApp: true, email: false })
        .expect(200);
      expect(effective(h).getEffectivePermissions).not.toHaveBeenCalled();
      expect(svc.setPreference).toHaveBeenCalledWith(ROOT.id, "clamav-stale", { inApp: true, email: false });
    });

    it("403 on turning one on without the permissions, and nothing is written", async () => {
      await put({ source: "clamav-unreachable", inApp: true, email: false }).expect(403);
      await put({ source: "clamav-unreachable", inApp: false, email: true }).expect(403);
      expect(svc.setPreference).not.toHaveBeenCalled();
    });

    it("turns one on once the permissions are held", async () => {
      effective(h).getEffectivePermissions.mockResolvedValue({ global: CLAMAV_STATUS });
      await put({ source: "clamav-stale", inApp: true, email: true }).expect(200);
      expect(svc.setPreference).toHaveBeenCalledWith(USER.id, "clamav-stale", { inApp: true, email: true });
    });

    // A permission lost after the box was ticked: the box stays as it was, and
    // it can always be unticked.
    it("lets an account that lost the permissions turn a channel off", async () => {
      svc.channelsFor.mockResolvedValue({ inApp: true, email: true });
      await put({ source: "clamav-stale", inApp: false, email: false }).expect(200);
      expect(svc.setPreference).toHaveBeenCalledWith(USER.id, "clamav-stale", { inApp: false, email: false });
    });

    it("lets it keep a channel that was already on while turning the other off", async () => {
      svc.channelsFor.mockResolvedValue({ inApp: true, email: true });
      await put({ source: "clamav-stale", inApp: true, email: false }).expect(200);
      expect(svc.setPreference).toHaveBeenCalledWith(USER.id, "clamav-stale", { inApp: true, email: false });
    });

    it("still refuses to turn on the channel that was off", async () => {
      svc.channelsFor.mockResolvedValue({ inApp: true, email: false });
      await put({ source: "clamav-stale", inApp: true, email: true }).expect(403);
      expect(svc.setPreference).not.toHaveBeenCalled();
    });
  });

  describe("validation (400)", () => {
    it("400 on a non-numeric notification id", async () => {
      await call("post", `${base}/abc/read`).set("Authorization", user()).expect(400);
    });

    it("400 on a purge scope that is neither read nor all", async () => {
      await api().delete(`${base}?scope=everything`).set("Authorization", user()).expect(400);
      expect(svc.purge).not.toHaveBeenCalled();
    });

    it("400 on a source that is not one of the declared ones", async () => {
      await api().get(`${base}?source=billing`).set("Authorization", user()).expect(400);
      expect(svc.list).not.toHaveBeenCalled();
    });

    it("400 on a read filter that is neither read nor unread", async () => {
      await api().get(`${base}?read=maybe`).set("Authorization", user()).expect(400);
      expect(svc.list).not.toHaveBeenCalled();
    });

    it("forwards the page, the filter and the sort as parsed values", async () => {
      await api()
        .get(`${base}?limit=25&offset=50&read=unread&source=support&sortBy=source&sortDir=asc&search=ovh`)
        .set("Authorization", user())
        .expect(200);
      expect(svc.list).toHaveBeenCalledWith(USER.id, {
        limit: 25,
        offset: 50,
        read: "unread",
        source: "support",
        sortBy: "source",
        sortDir: "asc",
        search: "ovh",
      });
    });

    it("400 on an unknown notification source", async () => {
      await api()
        .put(`${base}/preferences`)
        .set("Authorization", user())
        .send({ source: "billing", inApp: true, email: true })
        .expect(400);
    });

    it("400 when a channel flag is missing", async () => {
      await api().put(`${base}/preferences`).set("Authorization", user()).send({ source: "support", inApp: true }).expect(400);
    });

    it("400 on an unknown extra field", async () => {
      await api()
        .put(`${base}/preferences`)
        .set("Authorization", user())
        .send({ source: "support", inApp: true, email: true, sms: true })
        .expect(400);
    });

    it("400 on a non-boolean channel flag", async () => {
      await api()
        .put(`${base}/preferences`)
        .set("Authorization", user())
        .send({ source: "support", inApp: "yes", email: true })
        .expect(400);
    });
  });
});
