import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import request from "supertest";
import { Fail2banController } from "../../src/api/fail2ban/fail2ban.controller";
import { ActivityLogService } from "../../src/core/activity/activity-log.service";
import { Fail2banService } from "../../src/core/fail2ban/fail2ban.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("Fail2banController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const fail2ban = { status: vi.fn(), ban: vi.fn(), unban: vi.fn() };
  const activity = { record: vi.fn() };
  const jail = {
    name: "dovecot",
    currentlyFailed: 0,
    totalFailed: 3,
    currentlyBanned: 1,
    totalBanned: 2,
    bantime: 3600,
    findtime: 300,
    maxretry: 5,
    bans: [{ ip: "203.0.113.9", bannedAt: 1, expiresAt: 2 }],
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [Fail2banController],
      providers: [
        { provide: Fail2banService, useValue: fail2ban },
        { provide: ActivityLogService, useValue: activity },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    vi.clearAllMocks();
    fail2ban.status.mockResolvedValue({ available: true, jails: [jail], history: [] });
    fail2ban.ban.mockResolvedValue({ ...jail, name: "manager" });
    activity.record.mockResolvedValue(undefined);
    fail2ban.unban.mockResolvedValue(jail);
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  describe("GET /fail2ban/jails", () => {
    const url = "/api/v1/fail2ban/jails";
    it("401 without a token", async () => {
      await api().get(url).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(url).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(url).set("Authorization", auth(USER)).expect(403);
    });
    it("403 for a user holding access but not view-fail2ban-jails", async () => {
      h.cpg.grantGlobal("fail2ban", "access", "ban-ip", "unban-ip");
      await api().get(url).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("fail2ban", "access", "view-fail2ban-jails");
      const res = await api().get(url).set("Authorization", auth(USER)).expect(200);
      expect(res.body).toEqual({ available: true, jails: [jail], history: [] });
    });
    it("200 for root", async () => {
      await api().get(url).set("Authorization", auth(ROOT)).expect(200);
    });
  });

  describe("POST /fail2ban/ban", () => {
    const url = "/api/v1/fail2ban/ban";
    it("401 without a token", async () => {
      await api().post(url).send({ ip: "203.0.113.9" }).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().post(url).set("Authorization", auth(USER)).send({ ip: "203.0.113.9" }).expect(403);
    });
    it("403 for a user holding only view-fail2ban-jails and unban-ip", async () => {
      h.cpg.grantGlobal("fail2ban", "access", "view-fail2ban-jails", "unban-ip");
      await api().post(url).set("Authorization", auth(USER)).send({ ip: "203.0.113.9" }).expect(403);
      expect(fail2ban.ban).not.toHaveBeenCalled();
    });
    it("200 for a user granted ban-ip, forwarding the address alone and writing it to the journal", async () => {
      h.cpg.grantGlobal("fail2ban", "access", "ban-ip");
      const res = await api().post(url).set("Authorization", auth(USER)).send({ ip: "203.0.113.9" }).expect(200);
      expect(res.body).toEqual({ ...jail, name: "manager" });
      expect(fail2ban.ban).toHaveBeenCalledWith("203.0.113.9");
      expect(activity.record).toHaveBeenCalledWith({
        action: "fail2ban.banned",
        entity: { type: "ip", label: "203.0.113.9" },
        details: { jail: "manager" },
      });
    });
    it("writes nothing to the journal when fail2ban refuses the ban", async () => {
      fail2ban.ban.mockRejectedValue(new ServiceUnavailableException("Fail2ban is out of reach"));
      await api().post(url).set("Authorization", auth(ROOT)).send({ ip: "203.0.113.9" }).expect(503);
      expect(activity.record).not.toHaveBeenCalled();
    });
    it("200 for root with an IPv6 address", async () => {
      await api().post(url).set("Authorization", auth(ROOT)).send({ ip: "2001:db8::1" }).expect(200);
      expect(fail2ban.ban).toHaveBeenCalledWith("2001:db8::1");
    });
    it.each([{}, { ip: "nope" }, { ip: "203.0.113.999" }])("400 on the body %j, without calling fail2ban", async (body) => {
      await api().post(url).set("Authorization", auth(ROOT)).send(body).expect(400);
      expect(fail2ban.ban).not.toHaveBeenCalled();
    });
    it("403 before 400: an invalid body is not a way to probe the route", async () => {
      await api().post(url).set("Authorization", auth(USER)).send({ ip: "nope" }).expect(403);
    });
  });

  describe("POST /fail2ban/jails/:jail/unban", () => {
    const url = "/api/v1/fail2ban/jails/dovecot/unban";
    it("401 without a token", async () => {
      await api().post(url).send({ ip: "203.0.113.9" }).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().post(url).set("Authorization", auth(USER)).send({ ip: "203.0.113.9" }).expect(403);
    });
    it("403 for a user holding only view-fail2ban-jails and ban-ip", async () => {
      h.cpg.grantGlobal("fail2ban", "access", "view-fail2ban-jails", "ban-ip");
      await api().post(url).set("Authorization", auth(USER)).send({ ip: "203.0.113.9" }).expect(403);
      expect(fail2ban.unban).not.toHaveBeenCalled();
    });
    it("200 for a user granted unban-ip, forwarding the jail and the address", async () => {
      h.cpg.grantGlobal("fail2ban", "access", "unban-ip");
      const res = await api().post(url).set("Authorization", auth(USER)).send({ ip: "203.0.113.9" }).expect(200);
      expect(res.body).toEqual(jail);
      expect(fail2ban.unban).toHaveBeenCalledWith("dovecot", "203.0.113.9");
      expect(activity.record).toHaveBeenCalledWith({
        action: "fail2ban.unbanned",
        entity: { type: "ip", label: "203.0.113.9" },
        details: { jail: "dovecot" },
      });
    });
    it.each([{}, { ip: "nope" }])("400 on the body %j, without calling fail2ban", async (body) => {
      await api().post(url).set("Authorization", auth(ROOT)).send(body).expect(400);
      expect(fail2ban.unban).not.toHaveBeenCalled();
    });
    it("400 on a jail name fail2ban cannot have", async () => {
      await api()
        .post("/api/v1/fail2ban/jails/a%20b/unban")
        .set("Authorization", auth(ROOT))
        .send({ ip: "203.0.113.9" })
        .expect(400);
      expect(fail2ban.unban).not.toHaveBeenCalled();
    });
    it("404 when fail2ban does not know the jail", async () => {
      fail2ban.unban.mockRejectedValue(new NotFoundException("Unknown jail"));
      await api()
        .post("/api/v1/fail2ban/jails/nojail/unban")
        .set("Authorization", auth(ROOT))
        .send({ ip: "203.0.113.9" })
        .expect(404);
      expect(activity.record).not.toHaveBeenCalled();
    });
  });
});
