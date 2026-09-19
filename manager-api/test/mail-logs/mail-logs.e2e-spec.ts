import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Readable } from "stream";
import request from "supertest";
import { MailLogsController } from "../../src/api/mail-logs/mail-logs.controller";
import { MailLogsService } from "../../src/api/mail-logs/mail-logs.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("MailLogsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const logs = { tail: vi.fn(), file: vi.fn() };
  const window = { service: "postfix", lines: ["a", "b"], size: 4, updatedAt: "2026-09-19T00:00:00.000Z", truncated: false };

  beforeAll(async () => {
    h = await buildHarness({ controllers: [MailLogsController], providers: [{ provide: MailLogsService, useValue: logs }] });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    vi.clearAllMocks();
    logs.tail.mockResolvedValue(window);
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;
  const postfix = "/api/v1/mail-logs/postfix";

  it("401 without a token", async () => {
    await api().get(postfix).expect(401);
  });
  it("401 with a garbage bearer token", async () => {
    await api().get(postfix).set("Authorization", "Bearer nope").expect(401);
  });
  it("403 for a user without the permission", async () => {
    await api().get(postfix).set("Authorization", auth(USER)).expect(403);
  });
  it("403 for a user holding access but not view-mail-logs", async () => {
    h.cpg.grantGlobal("supervision", "access");
    await api().get(postfix).set("Authorization", auth(USER)).expect(403);
  });
  it("403 for a user holding the other supervision actions only", async () => {
    h.cpg.grantGlobal("supervision", "access", "view-machine-metrics", "view-metrics-history", "view-activity-log");
    await api().get(postfix).set("Authorization", auth(USER)).expect(403);
  });
  it("200 for a user granted the exact permission, with the default window", async () => {
    h.cpg.grantGlobal("supervision", "access", "view-mail-logs");
    const res = await api().get(postfix).set("Authorization", auth(USER)).expect(200);
    expect(res.body).toEqual(window);
    expect(logs.tail).toHaveBeenCalledWith("postfix", { lines: 500 });
  });
  it("one permission reads both logs", async () => {
    h.cpg.grantGlobal("supervision", "access", "view-mail-logs");
    await api().get("/api/v1/mail-logs/dovecot?lines=20&q=imap").set("Authorization", auth(USER)).expect(200);
    expect(logs.tail).toHaveBeenCalledWith("dovecot", { lines: 20, q: "imap" });
  });
  it("forwards the before cursor to page back", async () => {
    await api().get(`${postfix}?before=1234`).set("Authorization", auth(ROOT)).expect(200);
    expect(logs.tail).toHaveBeenCalledWith("postfix", { lines: 500, before: 1234 });
  });
  it("400 on a negative before", async () => {
    await api().get(`${postfix}?before=-1`).set("Authorization", auth(ROOT)).expect(400);
  });
  it("200 for root", async () => {
    await api().get(postfix).set("Authorization", auth(ROOT)).expect(200);
  });
  it("400 on an unknown service, without reading anything", async () => {
    await api().get("/api/v1/mail-logs/rspamd").set("Authorization", auth(ROOT)).expect(400);
    expect(logs.tail).not.toHaveBeenCalled();
  });
  it("400 on a path climbing out of the log directory", async () => {
    await api().get("/api/v1/mail-logs/..%2F..%2Fetc%2Fpasswd").set("Authorization", auth(ROOT)).expect(400);
    expect(logs.tail).not.toHaveBeenCalled();
  });
  it.each(["0", "5001", "abc"])("400 on lines=%s", async (lines) => {
    await api().get(`${postfix}?lines=${lines}`).set("Authorization", auth(ROOT)).expect(400);
    expect(logs.tail).not.toHaveBeenCalled();
  });
  it("403 before 400: an unknown service is not a way to probe the route", async () => {
    await api().get("/api/v1/mail-logs/rspamd").set("Authorization", auth(USER)).expect(403);
  });

  describe("GET /mail-logs/:service/download", () => {
    const download = "/api/v1/mail-logs/postfix/download";
    const whole = () => ({ stream: Readable.from([Buffer.from("line one\nline two\n")]), size: 18 });

    it("401 without a token", async () => {
      await api().get(download).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(download).set("Authorization", auth(USER)).expect(403);
    });
    it("403 for a user holding access but not view-mail-logs", async () => {
      h.cpg.grantGlobal("supervision", "access");
      await api().get(download).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for a user granted the exact permission, with the whole file as an attachment", async () => {
      h.cpg.grantGlobal("supervision", "access", "view-mail-logs");
      logs.file.mockResolvedValue(whole());
      const res = await api().get(download).set("Authorization", auth(USER)).expect(200);
      expect(res.text).toBe("line one\nline two\n");
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.headers["content-disposition"]).toBe('attachment; filename="postfix.log"');
      expect(logs.file).toHaveBeenCalledWith("postfix");
    });
    it("200 for root on the dovecot log", async () => {
      logs.file.mockResolvedValue(whole());
      await api().get("/api/v1/mail-logs/dovecot/download").set("Authorization", auth(ROOT)).expect(200);
      expect(logs.file).toHaveBeenCalledWith("dovecot");
    });
    it("404 when the log does not exist yet", async () => {
      logs.file.mockResolvedValue(null);
      await api().get(download).set("Authorization", auth(ROOT)).expect(404);
    });
    it("400 on an unknown service, without opening anything", async () => {
      await api().get("/api/v1/mail-logs/rspamd/download").set("Authorization", auth(ROOT)).expect(400);
      expect(logs.file).not.toHaveBeenCalled();
    });
  });
});
