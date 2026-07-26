import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { TicketsController } from "../../src/api/tickets/tickets.controller";
import { TicketsService } from "../../src/api/tickets/tickets.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/tickets";
const DOMAIN_ID = 12;

type Method = "get" | "post" | "patch";

describe("TicketsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    messagesPage: vi.fn(),
    markRead: vi.fn(),
    reply: vi.fn(),
    editMessage: vi.fn(),
    take: vi.fn(),
    setStatus: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const call = (m: Method, path: string) => {
    const agent = api();
    return m === "get" ? agent.get(path) : m === "post" ? agent.post(path) : agent.patch(path);
  };
  const grant = (...actions: string[]) => {
    h.cpg.grantGlobal("tickets", "access", ...actions);
  };

  const routes: { name: string; method: Method; path: string }[] = [
    { name: "GET list", method: "get", path: base },
    { name: "POST create", method: "post", path: base },
    { name: "GET :id", method: "get", path: `${base}/5` },
    { name: "GET :id/messages", method: "get", path: `${base}/5/messages` },
    { name: "POST :id/messages", method: "post", path: `${base}/5/messages` },
    { name: "PATCH :id/messages/:messageId", method: "patch", path: `${base}/5/messages/9` },
    { name: "POST :id/read", method: "post", path: `${base}/5/read` },
    { name: "POST :id/take", method: "post", path: `${base}/5/take` },
    { name: "PATCH :id/status", method: "patch", path: `${base}/5/status` },
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

  describe("ACL (403 for a user without any grant)", () => {
    for (const r of routes) {
      it(`403 for USER -- ${r.name}`, async () => {
        await call(r.method, r.path).set("Authorization", user()).expect(403);
      });
    }
  });

  describe("GET / (list)", () => {
    it("200 for ROOT, forwards the parsed query + caller to the service", async () => {
      svc.list.mockResolvedValueOnce({ items: [], total: 0 });
      const res = await api().get(`${base}?limit=10&sortBy=status&sortDir=asc`).set("Authorization", root()).expect(200);
      expect(res.body).toEqual({ items: [], total: 0 });
      expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, sortBy: "status", sortDir: "asc" }), {
        userId: ROOT.id,
        isRoot: true,
      });
    });

    it("200 for a non-root user granted list-tickets", async () => {
      grant("list-tickets");
      svc.list.mockResolvedValueOnce([]);
      await api().get(base).set("Authorization", user()).expect(200);
      expect(svc.list).toHaveBeenCalledWith(expect.any(Object), { userId: USER.id, isRoot: false });
    });

    it("400 on an invalid pagination query (limit not 10/25/50)", async () => {
      await api().get(`${base}?limit=7`).set("Authorization", root()).expect(400);
      expect(svc.list).not.toHaveBeenCalled();
    });
  });

  describe("POST / (create)", () => {
    it("201 for ROOT, forwards the parsed body + caller", async () => {
      svc.create.mockResolvedValueOnce({ id: 1, subject: "Help" });
      const body = { domainId: DOMAIN_ID, subject: "Help", body: "It broke", visibility: "public" };
      const res = await api().post(base).set("Authorization", root()).send(body).expect(201);
      expect(res.body).toMatchObject({ id: 1 });
      expect(svc.create).toHaveBeenCalledWith(
        expect.objectContaining({ domainId: DOMAIN_ID, subject: "Help", body: "It broke", visibility: "public" }),
        { userId: ROOT.id, isRoot: true }
      );
    });

    it("201 for a non-root user granted create-ticket", async () => {
      grant("create-ticket");
      svc.create.mockResolvedValueOnce({ id: 2 });
      await api().post(base).set("Authorization", user()).send({ domainId: DOMAIN_ID, subject: "Hi", body: "hello" }).expect(201);
    });

    it("400 when domainId is missing", async () => {
      await api().post(base).set("Authorization", root()).send({ subject: "a", body: "b" }).expect(400);
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("400 on an empty subject", async () => {
      await api().post(base).set("Authorization", root()).send({ domainId: DOMAIN_ID, subject: "", body: "x" }).expect(400);
    });

    it("400 on an unknown field (strict schema)", async () => {
      await api()
        .post(base)
        .set("Authorization", root())
        .send({ domainId: DOMAIN_ID, subject: "a", body: "b", nope: 1 })
        .expect(400);
    });
  });

  describe("GET /:id", () => {
    it("200 for ROOT, forwards id + caller", async () => {
      svc.get.mockResolvedValueOnce({ id: 5, messages: [] });
      const res = await api().get(`${base}/5`).set("Authorization", root()).expect(200);
      expect(res.body).toMatchObject({ id: 5 });
      expect(svc.get).toHaveBeenCalledWith(5, { userId: ROOT.id, isRoot: true });
    });

    it("403 for USER granted only list-tickets (view-ticket is required)", async () => {
      grant("list-tickets");
      await api().get(`${base}/5`).set("Authorization", user()).expect(403);
    });

    it("200 for USER granted view-ticket", async () => {
      grant("view-ticket");
      svc.get.mockResolvedValueOnce({ id: 5 });
      await api().get(`${base}/5`).set("Authorization", user()).expect(200);
    });

    it("400 when :id is not an integer", async () => {
      await api().get(`${base}/abc`).set("Authorization", root()).expect(400);
      expect(svc.get).not.toHaveBeenCalled();
    });
  });

  describe("POST /:id/messages (reply)", () => {
    it("201 for ROOT, forwards id + body + caller", async () => {
      svc.reply.mockResolvedValueOnce({ id: 9, body: "ok" });
      const res = await api().post(`${base}/5/messages`).set("Authorization", root()).send({ body: "ok" }).expect(201);
      expect(res.body).toMatchObject({ id: 9 });
      expect(svc.reply).toHaveBeenCalledWith(5, expect.objectContaining({ body: "ok" }), { userId: ROOT.id, isRoot: true });
    });

    it("400 on empty body", async () => {
      await api().post(`${base}/5/messages`).set("Authorization", root()).send({ body: "" }).expect(400);
    });
  });

  describe("PATCH /:id/messages/:messageId (edit)", () => {
    it("200 for ROOT, forwards ids + body + caller", async () => {
      svc.editMessage.mockResolvedValueOnce({ id: 9, body: "new", editCount: 1 });
      const res = await api().patch(`${base}/5/messages/9`).set("Authorization", root()).send({ body: "new" }).expect(200);
      expect(res.body).toMatchObject({ id: 9, editCount: 1 });
      expect(svc.editMessage).toHaveBeenCalledWith(5, 9, "new", { userId: ROOT.id, isRoot: true });
    });

    it("400 on empty body", async () => {
      await api().patch(`${base}/5/messages/9`).set("Authorization", root()).send({ body: "" }).expect(400);
    });

    it("400 when :messageId is not an integer", async () => {
      await api().patch(`${base}/5/messages/nope`).set("Authorization", root()).send({ body: "x" }).expect(400);
    });
  });

  describe("POST /:id/take (support role)", () => {
    it("403 for USER without handle-ticket (create-ticket is not enough)", async () => {
      grant("create-ticket");
      await api().post(`${base}/5/take`).set("Authorization", user()).expect(403);
    });

    it("201 for USER granted handle-ticket", async () => {
      grant("handle-ticket");
      svc.take.mockResolvedValueOnce({ id: 5, status: "in_progress" });
      await api().post(`${base}/5/take`).set("Authorization", user()).expect(201);
      expect(svc.take).toHaveBeenCalledWith(5, { userId: USER.id, isRoot: false });
    });
  });

  describe("PATCH /:id/status", () => {
    it("200 for ROOT with a valid status", async () => {
      svc.setStatus.mockResolvedValueOnce({ id: 5, status: "resolved" });
      await api().patch(`${base}/5/status`).set("Authorization", root()).send({ status: "resolved" }).expect(200);
      expect(svc.setStatus).toHaveBeenCalledWith(5, "resolved", { userId: ROOT.id, isRoot: true });
    });

    it("400 on an invalid status", async () => {
      await api().patch(`${base}/5/status`).set("Authorization", root()).send({ status: "wat" }).expect(400);
      expect(svc.setStatus).not.toHaveBeenCalled();
    });

    // The route only gates "can this account see the ticket": whether it may
    // actually drive the status is a row rule (author closing vs support role)
    // that only TicketsService can answer, so it is asserted in its own spec.
    it("403 for USER without view-ticket", async () => {
      grant("create-ticket");
      await api().patch(`${base}/5/status`).set("Authorization", user()).send({ status: "closed" }).expect(403);
      expect(svc.setStatus).not.toHaveBeenCalled();
    });

    it("hands a viewer over to the service, which owns the rule", async () => {
      grant("view-ticket");
      await api().patch(`${base}/5/status`).set("Authorization", user()).send({ status: "closed" }).expect(200);
      expect(svc.setStatus).toHaveBeenCalledWith(5, "closed", { userId: USER.id, isRoot: false });
    });
  });
});
