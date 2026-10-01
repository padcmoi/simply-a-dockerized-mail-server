import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { PostfixController } from "../../src/api/postfix/postfix.controller";
import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ActivityLogService } from "../../src/core/activity/activity-log.service";
import { PostfixCommandsService } from "../../src/core/postfix/postfix-commands.service";
import { PostfixService } from "../../src/core/postfix/postfix.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("PostfixController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = { queueStats: vi.fn(), queueMessages: vi.fn() };
  const commands = { deleteMessage: vi.fn(), retryMessage: vi.fn() };
  const activity = { record: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [PostfixController],
      providers: [
        { provide: PostfixService, useValue: svc },
        { provide: PostfixCommandsService, useValue: commands },
        { provide: ActivityLogService, useValue: activity },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    svc.queueMessages.mockReset();
    commands.deleteMessage.mockReset().mockResolvedValue(undefined);
    commands.retryMessage.mockReset().mockResolvedValue(undefined);
    activity.record.mockReset().mockResolvedValue(undefined);
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;
  const url = "/api/v1/postfix/queue";

  it("401 without a token", async () => {
    await api().get(url).expect(401);
  });
  it("401 with a garbage bearer token", async () => {
    await api().get(url).set("Authorization", "Bearer nope").expect(401);
  });
  it("403 for a user without the permission", async () => {
    await api().get(url).set("Authorization", auth(USER)).expect(403);
  });
  it("200 for root and forwards no domain when the query is absent", async () => {
    svc.queueStats.mockResolvedValue({ total: { active: 0, deferred: 0, hold: 0, incoming: 0 }, available: true });
    const res = await api().get(url).set("Authorization", auth(ROOT)).expect(200);
    expect(res.body.available).toBe(true);
    expect(svc.queueStats).toHaveBeenCalledWith(undefined);
  });
  it("200 for root and forwards the domain query to the service", async () => {
    svc.queueStats.mockResolvedValue({ total: { active: 1, deferred: 0, hold: 0, incoming: 0 }, available: true });
    await api().get(url).query({ domain: "example.com" }).set("Authorization", auth(ROOT)).expect(200);
    expect(svc.queueStats).toHaveBeenCalledWith("example.com");
  });
  it("200 for a user granted the exact permission", async () => {
    h.cpg.grantGlobal("postfix", "access", "view-postfix-queue");
    svc.queueStats.mockResolvedValue({ total: { active: 0, deferred: 0, hold: 0, incoming: 0 }, available: true });
    await api().get(url).set("Authorization", auth(USER)).expect(200);
  });

  describe("GET /queue/:queue/messages", () => {
    const messagesUrl = (queue: string) => `/api/v1/postfix/queue/${queue}/messages`;
    const view = { queue: "deferred", total: 0, limit: 500, messages: [], available: true };

    it("401 without a token", async () => {
      await api().get(messagesUrl("deferred")).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(messagesUrl("deferred")).set("Authorization", auth(USER)).expect(403);
      expect(svc.queueMessages).not.toHaveBeenCalled();
    });
    it("403 for a user holding only postfix:access", async () => {
      h.cpg.grantGlobal("postfix", "access");
      await api().get(messagesUrl("deferred")).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for a user granted the exact permission, forwarding the queue", async () => {
      h.cpg.grantGlobal("postfix", "access", "view-postfix-queue");
      svc.queueMessages.mockResolvedValue(view);
      const res = await api().get(messagesUrl("deferred")).set("Authorization", auth(USER)).expect(200);
      expect(res.body).toEqual(view);
      expect(svc.queueMessages).toHaveBeenCalledWith("deferred");
    });
    for (const queue of ["active", "deferred", "hold", "incoming"]) {
      it(`200 for root on ${queue}`, async () => {
        svc.queueMessages.mockResolvedValue({ ...view, queue });
        await api().get(messagesUrl(queue)).set("Authorization", auth(ROOT)).expect(200);
        expect(svc.queueMessages).toHaveBeenCalledWith(queue);
      });
    }
    for (const queue of ["maildrop", "defer", "..%2Fetc", "ACTIVE"]) {
      it(`400 for the unknown queue ${queue}`, async () => {
        svc.queueMessages.mockClear();
        await api().get(messagesUrl(queue)).set("Authorization", auth(ROOT)).expect(400);
        expect(svc.queueMessages).not.toHaveBeenCalled();
      });
    }
  });

  describe("DELETE /queue/:queue/messages/:id", () => {
    const purgeUrl = (queue: string, id: string) => `/api/v1/postfix/queue/${queue}/messages/${id}`;

    it("401 without a token", async () => {
      await api().delete(purgeUrl("deferred", "60CD226AED9")).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().delete(purgeUrl("deferred", "60CD226AED9")).set("Authorization", auth(USER)).expect(403);
      expect(commands.deleteMessage).not.toHaveBeenCalled();
    });
    it("403 for a user who may only view the queue", async () => {
      h.cpg.grantGlobal("postfix", "access", "view-postfix-queue");
      await api().delete(purgeUrl("deferred", "60CD226AED9")).set("Authorization", auth(USER)).expect(403);
      expect(commands.deleteMessage).not.toHaveBeenCalled();
    });
    it("204 for a user granted the purge, sending the command and journaling it", async () => {
      h.cpg.grantGlobal("postfix", "access", "purge-postfix-queue-message");
      await api().delete(purgeUrl("deferred", "60CD226AED9")).set("Authorization", auth(USER)).expect(204);
      expect(commands.deleteMessage).toHaveBeenCalledWith("deferred", "60CD226AED9");
      expect(activity.record).toHaveBeenCalledWith({
        action: "postfix.message-purged",
        entity: { type: "postfix-message", id: "60CD226AED9", label: "60CD226AED9" },
        details: { queue: "deferred" },
      });
    });
    it("204 for root on every queue", async () => {
      for (const queue of ["active", "deferred", "hold", "incoming"]) {
        await api().delete(purgeUrl(queue, "ABCDEF123")).set("Authorization", auth(ROOT)).expect(204);
      }
      expect(commands.deleteMessage).toHaveBeenCalledTimes(4);
    });
    for (const [queue, id] of [
      ["maildrop", "60CD226AED9"],
      ["deferred", "ALL"],
      ["deferred", "60CD2%2F..%2F"],
      ["deferred", "60CD226AED9%20-d%20ALL"],
    ]) {
      it(`400 for ${queue}/${id}, nothing sent`, async () => {
        await api().delete(purgeUrl(queue, id)).set("Authorization", auth(ROOT)).expect(400);
        expect(commands.deleteMessage).not.toHaveBeenCalled();
      });
    }
    it("404 when the message is no longer there, nothing journaled", async () => {
      commands.deleteMessage.mockRejectedValue(new NotFoundException("gone"));
      await api().delete(purgeUrl("deferred", "60CD226AED9")).set("Authorization", auth(ROOT)).expect(404);
      expect(activity.record).not.toHaveBeenCalled();
    });
    it("503 when Postfix does not answer, nothing journaled", async () => {
      commands.deleteMessage.mockRejectedValue(new ServiceUnavailableException("late"));
      await api().delete(purgeUrl("deferred", "60CD226AED9")).set("Authorization", auth(ROOT)).expect(503);
      expect(activity.record).not.toHaveBeenCalled();
    });
  });

  describe("POST /queue/:queue/messages/:id/retry", () => {
    const retryUrl = (queue: string, id: string) => `/api/v1/postfix/queue/${queue}/messages/${id}/retry`;

    it("401 without a token", async () => {
      await api().post(retryUrl("deferred", "60CD226AED9")).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().post(retryUrl("deferred", "60CD226AED9")).set("Authorization", auth(USER)).expect(403);
      expect(commands.retryMessage).not.toHaveBeenCalled();
    });
    it("403 for a user who may view and purge the queue but not retry", async () => {
      h.cpg.grantGlobal("postfix", "access", "view-postfix-queue", "purge-postfix-queue-message");
      await api().post(retryUrl("deferred", "60CD226AED9")).set("Authorization", auth(USER)).expect(403);
      expect(commands.retryMessage).not.toHaveBeenCalled();
    });
    it("403 on the purge for a user who may only retry", async () => {
      h.cpg.grantGlobal("postfix", "access", "retry-postfix-queue-message");
      await api().delete("/api/v1/postfix/queue/deferred/messages/60CD226AED9").set("Authorization", auth(USER)).expect(403);
      expect(commands.deleteMessage).not.toHaveBeenCalled();
    });
    it("204 for a user granted the retry, sending the command and journaling it", async () => {
      h.cpg.grantGlobal("postfix", "access", "retry-postfix-queue-message");
      await api().post(retryUrl("hold", "60CD226AED9")).set("Authorization", auth(USER)).expect(204);
      expect(commands.retryMessage).toHaveBeenCalledWith("hold", "60CD226AED9");
      expect(activity.record).toHaveBeenCalledWith({
        action: "postfix.message-retried",
        entity: { type: "postfix-message", id: "60CD226AED9", label: "60CD226AED9" },
        details: { queue: "hold" },
      });
    });
    it("204 for root on the deferred and the hold queues", async () => {
      for (const queue of ["deferred", "hold"]) {
        await api().post(retryUrl(queue, "ABCDEF123")).set("Authorization", auth(ROOT)).expect(204);
      }
      expect(commands.retryMessage).toHaveBeenCalledTimes(2);
    });
    for (const [queue, id] of [
      ["active", "60CD226AED9"],
      ["incoming", "60CD226AED9"],
      ["maildrop", "60CD226AED9"],
      ["deferred", "ALL"],
      ["deferred", "60CD2%2F..%2F"],
      ["hold", "60CD226AED9%20-f"],
    ]) {
      it(`400 for ${queue}/${id}, nothing sent`, async () => {
        await api().post(retryUrl(queue, id)).set("Authorization", auth(ROOT)).expect(400);
        expect(commands.retryMessage).not.toHaveBeenCalled();
      });
    }
    it("404 when the message is no longer there, nothing journaled", async () => {
      commands.retryMessage.mockRejectedValue(new NotFoundException("gone"));
      await api().post(retryUrl("deferred", "60CD226AED9")).set("Authorization", auth(ROOT)).expect(404);
      expect(activity.record).not.toHaveBeenCalled();
    });
    it("503 when Postfix does not answer, nothing journaled", async () => {
      commands.retryMessage.mockRejectedValue(new ServiceUnavailableException("late"));
      await api().post(retryUrl("deferred", "60CD226AED9")).set("Authorization", auth(ROOT)).expect(503);
      expect(activity.record).not.toHaveBeenCalled();
    });
  });
});
