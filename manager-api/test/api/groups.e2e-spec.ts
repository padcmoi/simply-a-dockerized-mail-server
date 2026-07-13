import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { GroupsController } from "../../src/api/groups/groups.controller";
import { GroupsService } from "../../src/api/groups/groups.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// Well-formed uuids so ParseUUIDPipe passes and only the guard / body pipe can
// reject; deliberately malformed ones drive the 400 assertions.
const GID = "11111111-1111-1111-1111-111111111111";
const AID = "22222222-2222-2222-2222-222222222222";

describe("GroupsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  // One vi.fn per method the controller forwards to (note: the two bulk routes
  // call addAllAccounts / removeAllMembers, not add/removeAllMembers).
  const svc = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getDetail: vi.fn(),
    setGlobalPermissions: vi.fn(),
    setDomainPermissions: vi.fn(),
    updateOwner: vi.fn(),
    listMembers: vi.fn(),
    addAllAccounts: vi.fn(),
    removeAllMembers: vi.fn(),
    addMember: vi.fn(),
    addMembers: vi.fn(),
    removeMember: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [GroupsController],
      providers: [{ provide: GroupsService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const call = (method: string, path: string) =>
    (api() as unknown as Record<string, (p: string) => request.Test>)[method](path);

  // Routes gated by a real global "groups" permission requirement: the guard
  // enforces the exact (resource, action) pairs. `svcKey` is null for the static
  // catalog route, which never touches the service.
  const GLOBAL_ROUTES: Array<{
    m: string;
    p: string;
    actions: string[];
    svcKey: keyof typeof svc | null;
    body?: object;
    ok: number;
  }> = [
    { m: "get", p: `/api/v1/groups`, actions: ["access", "list-groups"], svcKey: "list", ok: 200 },
    { m: "get", p: `/api/v1/groups/permissions/catalog`, actions: ["access", "view-group"], svcKey: null, ok: 200 },
    { m: "post", p: `/api/v1/groups`, actions: ["access", "create-group"], svcKey: "create", body: { name: "G" }, ok: 201 },
    { m: "patch", p: `/api/v1/groups/${GID}`, actions: ["access", "edit-group"], svcKey: "update", body: { name: "G2" }, ok: 200 },
    { m: "delete", p: `/api/v1/groups/${GID}`, actions: ["access", "delete-group"], svcKey: "remove", ok: 200 },
    { m: "get", p: `/api/v1/groups/${GID}`, actions: ["access", "view-group"], svcKey: "getDetail", ok: 200 },
    {
      m: "put",
      p: `/api/v1/groups/${GID}/global-permissions`,
      actions: ["access", "edit-group-global-permissions"],
      svcKey: "setGlobalPermissions",
      body: { permissions: [] },
      ok: 200,
    },
    {
      m: "put",
      p: `/api/v1/groups/${GID}/domain-permissions`,
      actions: ["access", "edit-group-domain-permissions"],
      svcKey: "setDomainPermissions",
      body: { permissions: [] },
      ok: 200,
    },
    {
      m: "get",
      p: `/api/v1/groups/${GID}/members`,
      actions: ["access", "list-group-members"],
      svcKey: "listMembers",
      ok: 200,
    },
  ];

  // Routes the guard lets any authenticated caller through: either
  // @ServiceEnforcedGlobalPermissions (owner-or-permission enforced in the
  // service) or the two @RequireGlobalPermissions([]) bulk routes (root-only,
  // also enforced in the service). The guard must NOT 403 these for a plain USER.
  const SERVICE_ROUTES: Array<{ m: string; p: string; svcKey: keyof typeof svc; body?: object }> = [
    { m: "patch", p: `/api/v1/groups/${GID}/owner`, svcKey: "updateOwner", body: { newOwnerId: AID } },
    { m: "post", p: `/api/v1/groups/${GID}/members`, svcKey: "addMember", body: { accountId: AID } },
    { m: "post", p: `/api/v1/groups/${GID}/members/bulk`, svcKey: "addMembers", body: { accountIds: [AID] } },
    { m: "delete", p: `/api/v1/groups/${GID}/members/${AID}`, svcKey: "removeMember" },
    { m: "post", p: `/api/v1/groups/${GID}/members/all`, svcKey: "addAllAccounts" },
    { m: "delete", p: `/api/v1/groups/${GID}/members/all`, svcKey: "removeAllMembers" },
  ];

  describe("auth (401)", () => {
    for (const { m, p } of [...GLOBAL_ROUTES, ...SERVICE_ROUTES]) {
      it(`401 without a token: ${m.toUpperCase()} ${p}`, async () => {
        await call(m, p).expect(401);
      });
      it(`401 with a garbage bearer token: ${m.toUpperCase()} ${p}`, async () => {
        await call(m, p).set("Authorization", "Bearer nope").expect(401);
      });
    }
  });

  describe("ACL: global-permission routes", () => {
    for (const route of GLOBAL_ROUTES) {
      const { m, p, actions, svcKey, body, ok } = route;

      it(`403 for a USER without the grant: ${m.toUpperCase()} ${p}`, async () => {
        const req = call(m, p).set("Authorization", `Bearer ${h.token(USER)}`);
        await (body ? req.send(body) : req).expect(403);
      });

      it(`${ok} for a USER granted the exact permission: ${m.toUpperCase()} ${p}`, async () => {
        h.cpg.grantGlobal("groups", ...actions);
        if (svcKey) svc[svcKey].mockResolvedValueOnce(undefined);
        const req = call(m, p).set("Authorization", `Bearer ${h.token(USER)}`);
        await (body ? req.send(body) : req).expect(ok);
        if (svcKey) expect(svc[svcKey]).toHaveBeenCalled();
      });

      it(`${ok} for ROOT regardless of grants (bypass): ${m.toUpperCase()} ${p}`, async () => {
        if (svcKey) svc[svcKey].mockResolvedValueOnce(undefined);
        const req = call(m, p).set("Authorization", `Bearer ${h.token(ROOT)}`);
        await (body ? req.send(body) : req).expect(ok);
      });
    }
  });

  describe("ACL: service-enforced + bulk routes pass the guard for a plain USER", () => {
    for (const { m, p, svcKey, body } of SERVICE_ROUTES) {
      it(`USER clears the guard and the service is invoked: ${m.toUpperCase()} ${p}`, async () => {
        svc[svcKey].mockResolvedValueOnce(undefined);
        const req = call(m, p).set("Authorization", `Bearer ${h.token(USER)}`);
        const res = await (body ? req.send(body) : req);
        // The guard never rejects these; whatever the service returns, it is not
        // the guard's 403.
        expect(res.status).not.toBe(403);
        expect(svc[svcKey]).toHaveBeenCalled();
      });
    }
  });

  describe("behavior: the controller forwards the right arguments", () => {
    it("GET /groups forwards the acting user and the validated pagination query", async () => {
      svc.list.mockResolvedValueOnce({ items: [], total: 0 });
      await api().get("/api/v1/groups?limit=10&sortBy=name").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.list).toHaveBeenCalledWith(
        expect.objectContaining({ id: ROOT.id, isRoot: true }),
        expect.objectContaining({ limit: 10, offset: 0, sortDir: "desc", sortBy: "name" })
      );
    });

    it("GET /groups/permissions/catalog returns the global + domain catalog", async () => {
      const res = await api()
        .get("/api/v1/groups/permissions/catalog")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .expect(200);
      expect(res.body).toHaveProperty("global.resources");
      expect(res.body).toHaveProperty("global.actionsByResource");
      expect(res.body).toHaveProperty("domain.resources");
      expect(res.body.global.resources).toContain("groups");
    });

    it("POST /groups forwards (ownerId, actingUserId, body) -- both ids are the caller", async () => {
      svc.create.mockResolvedValueOnce({ id: GID, name: "Marketing" });
      await api()
        .post("/api/v1/groups")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ name: "Marketing", description: "d", isDefault: true })
        .expect(201);
      expect(svc.create).toHaveBeenCalledWith(ROOT.id, ROOT.id, { name: "Marketing", description: "d", isDefault: true });
    });

    it("PATCH /groups/:id forwards id, acting user and body", async () => {
      svc.update.mockResolvedValueOnce({ id: GID });
      await api()
        .patch(`/api/v1/groups/${GID}`)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ name: "Renamed" })
        .expect(200);
      expect(svc.update).toHaveBeenCalledWith(GID, expect.objectContaining({ id: ROOT.id }), { name: "Renamed" });
    });

    it("DELETE /groups/:id forwards id and acting user", async () => {
      svc.remove.mockResolvedValueOnce({ ok: true });
      await api().delete(`/api/v1/groups/${GID}`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.remove).toHaveBeenCalledWith(GID, expect.objectContaining({ id: ROOT.id }));
    });

    it("GET /groups/:id forwards id and acting user", async () => {
      svc.getDetail.mockResolvedValueOnce({ id: GID });
      await api().get(`/api/v1/groups/${GID}`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.getDetail).toHaveBeenCalledWith(GID, expect.objectContaining({ id: ROOT.id }));
    });

    it("PUT /groups/:id/global-permissions forwards only body.permissions", async () => {
      svc.setGlobalPermissions.mockResolvedValueOnce({ id: GID });
      const permissions = [{ resource: "groups", action: "access" }];
      await api()
        .put(`/api/v1/groups/${GID}/global-permissions`)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ permissions })
        .expect(200);
      expect(svc.setGlobalPermissions).toHaveBeenCalledWith(GID, expect.objectContaining({ id: ROOT.id }), permissions);
    });

    it("PUT /groups/:id/domain-permissions forwards only body.permissions", async () => {
      svc.setDomainPermissions.mockResolvedValueOnce({ id: GID });
      const permissions = [{ domainId: 1, resource: "recipients", action: "access" }];
      await api()
        .put(`/api/v1/groups/${GID}/domain-permissions`)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ permissions })
        .expect(200);
      expect(svc.setDomainPermissions).toHaveBeenCalledWith(GID, expect.objectContaining({ id: ROOT.id }), permissions);
    });

    it("GET /groups/:id/members forwards id, acting user and the pagination query", async () => {
      svc.listMembers.mockResolvedValueOnce({ items: [], total: 0 });
      await api()
        .get(`/api/v1/groups/${GID}/members?limit=25&search=bob`)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .expect(200);
      expect(svc.listMembers).toHaveBeenCalledWith(
        GID,
        expect.objectContaining({ id: ROOT.id }),
        expect.objectContaining({ limit: 25, search: "bob" })
      );
    });

    it("PATCH /groups/:id/owner forwards id, acting user and body.newOwnerId (USER clears the guard)", async () => {
      svc.updateOwner.mockResolvedValueOnce({ id: GID });
      await api()
        .patch(`/api/v1/groups/${GID}/owner`)
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .send({ newOwnerId: AID })
        .expect(200);
      expect(svc.updateOwner).toHaveBeenCalledWith(GID, expect.objectContaining({ id: USER.id }), AID);
    });

    it("POST /groups/:id/members forwards id, acting user and body.accountId", async () => {
      svc.addMember.mockResolvedValueOnce([]);
      await api()
        .post(`/api/v1/groups/${GID}/members`)
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .send({ accountId: AID })
        .expect(201);
      expect(svc.addMember).toHaveBeenCalledWith(GID, expect.objectContaining({ id: USER.id }), AID);
    });

    it("POST /groups/:id/members/bulk forwards id, acting user and body.accountIds", async () => {
      svc.addMembers.mockResolvedValueOnce({ added: 1 });
      await api()
        .post(`/api/v1/groups/${GID}/members/bulk`)
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .send({ accountIds: [AID] })
        .expect(201);
      expect(svc.addMembers).toHaveBeenCalledWith(GID, expect.objectContaining({ id: USER.id }), [AID]);
    });

    it("DELETE /groups/:id/members/:accountId forwards id, acting user and accountId", async () => {
      svc.removeMember.mockResolvedValueOnce([]);
      await api()
        .delete(`/api/v1/groups/${GID}/members/${AID}`)
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .expect(200);
      expect(svc.removeMember).toHaveBeenCalledWith(GID, expect.objectContaining({ id: USER.id }), AID);
    });

    it("POST /groups/:id/members/all forwards to addAllAccounts (id, acting user)", async () => {
      svc.addAllAccounts.mockResolvedValueOnce([]);
      await api().post(`/api/v1/groups/${GID}/members/all`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(201);
      expect(svc.addAllAccounts).toHaveBeenCalledWith(GID, expect.objectContaining({ id: ROOT.id, isRoot: true }));
    });

    it("DELETE /groups/:id/members/all forwards to removeAllMembers (id, acting user)", async () => {
      svc.removeAllMembers.mockResolvedValueOnce([]);
      await api().delete(`/api/v1/groups/${GID}/members/all`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.removeAllMembers).toHaveBeenCalledWith(GID, expect.objectContaining({ id: ROOT.id, isRoot: true }));
    });
  });

  describe("validation (400) -- run as ROOT so the guard never masks the pipe", () => {
    const root = () => `Bearer ${h.token(ROOT)}`;

    it("POST /groups 400 when name is missing", async () => {
      await api().post("/api/v1/groups").set("Authorization", root()).send({}).expect(400);
    });

    it("POST /groups 400 when name is empty", async () => {
      await api().post("/api/v1/groups").set("Authorization", root()).send({ name: "" }).expect(400);
    });

    it("GET /groups 400 on an invalid pagination query (limit not in {10,25,50})", async () => {
      await api().get("/api/v1/groups?limit=7").set("Authorization", root()).expect(400);
    });

    it("PATCH /groups/:id 400 when :id is not a uuid", async () => {
      await api().patch("/api/v1/groups/not-a-uuid").set("Authorization", root()).send({ name: "X" }).expect(400);
    });

    it("PATCH /groups/:id 400 on an invalid body (empty name)", async () => {
      await api().patch(`/api/v1/groups/${GID}`).set("Authorization", root()).send({ name: "" }).expect(400);
    });

    it("GET /groups/:id 400 when :id is not a uuid", async () => {
      await api().get("/api/v1/groups/not-a-uuid").set("Authorization", root()).expect(400);
    });

    it("DELETE /groups/:id 400 when :id is not a uuid", async () => {
      await api().delete("/api/v1/groups/not-a-uuid").set("Authorization", root()).expect(400);
    });

    it("PUT /groups/:id/global-permissions 400 on an unknown action (discriminated union)", async () => {
      await api()
        .put(`/api/v1/groups/${GID}/global-permissions`)
        .set("Authorization", root())
        .send({ permissions: [{ resource: "groups", action: "not-a-real-action" }] })
        .expect(400);
    });

    it("PUT /groups/:id/domain-permissions 400 when domainId is missing", async () => {
      await api()
        .put(`/api/v1/groups/${GID}/domain-permissions`)
        .set("Authorization", root())
        .send({ permissions: [{ resource: "recipients", action: "access" }] })
        .expect(400);
    });

    it("PATCH /groups/:id/owner 400 when newOwnerId is not a uuid", async () => {
      await api().patch(`/api/v1/groups/${GID}/owner`).set("Authorization", root()).send({ newOwnerId: "nope" }).expect(400);
    });

    it("POST /groups/:id/members 400 when accountId is not a uuid", async () => {
      await api().post(`/api/v1/groups/${GID}/members`).set("Authorization", root()).send({ accountId: "nope" }).expect(400);
    });

    it("POST /groups/:id/members/bulk 400 on an empty accountIds array", async () => {
      await api().post(`/api/v1/groups/${GID}/members/bulk`).set("Authorization", root()).send({ accountIds: [] }).expect(400);
    });

    it("POST /groups/:id/members/bulk 400 when an accountId is not a uuid", async () => {
      await api()
        .post(`/api/v1/groups/${GID}/members/bulk`)
        .set("Authorization", root())
        .send({ accountIds: ["not-a-uuid"] })
        .expect(400);
    });

    it("DELETE /groups/:id/members/:accountId 400 when :accountId is not a uuid", async () => {
      await api().delete(`/api/v1/groups/${GID}/members/not-a-uuid`).set("Authorization", root()).expect(400);
    });

    it("POST /groups/:id/members/all 400 when :id is not a uuid", async () => {
      await api().post("/api/v1/groups/not-a-uuid/members/all").set("Authorization", root()).expect(400);
    });

    it("GET /groups/:id/members 400 on an invalid pagination query", async () => {
      await api().get(`/api/v1/groups/${GID}/members?limit=7`).set("Authorization", root()).expect(400);
    });
  });
});
