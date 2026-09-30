import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { PostfixService, QUEUE_MESSAGES_LIMIT } from "../../src/core/postfix/postfix.service";
import { providerMock } from "../helpers/mocks";
import { queueFile } from "../helpers/postfix-queue";

describe("PostfixService.queueMessages", () => {
  let spool: string;
  let service: PostfixService;

  const put = async (path: string, content: Buffer | string) => {
    const full = join(spool, path);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content);
  };

  beforeEach(async () => {
    spool = await mkdtemp(join(tmpdir(), "postfix-spool-"));
    service = new PostfixService(providerMock<ConfigService>({ get: vi.fn(() => spool) }));
  });
  afterEach(async () => {
    await rm(spool, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("lists the messages of the hashed subdirectories, newest first, with their deferral reasons", async () => {
    await put(
      "deferred/6/60CD226AED9",
      queueFile({ sender: "a@example.com", recipients: ["b@example.org", "c@example.org"], arrival: 100 })
    );
    await put("deferred/8/8BF6826AF21", queueFile({ sender: "", recipients: ["d@example.org"], arrival: 200 }));
    await put(
      "defer/6/60CD226AED9",
      "<b@example.org>: timed out\nrecipient=b@example.org\nstatus=4.4.1\nreason=connect to mx: timed out\n\n"
    );

    const view = await service.queueMessages("deferred");

    expect(view).toMatchObject({ queue: "deferred", total: 2, limit: QUEUE_MESSAGES_LIMIT, available: true });
    expect(view.messages.map((m) => m.id)).toEqual(["8BF6826AF21", "60CD226AED9"]);
    expect(view.messages[0]).toEqual({
      id: "8BF6826AF21",
      arrivalTime: new Date(200_000).toISOString(),
      size: 24,
      sender: "",
      recipients: [{ address: "d@example.org", status: null, reason: null }],
    });
    expect(view.messages[1].recipients).toEqual([
      { address: "b@example.org", status: "4.4.1", reason: "connect to mx: timed out" },
      { address: "c@example.org", status: null, reason: null },
    ]);
  });

  it("reads a flat queue such as hold, and finds its reason in the hashed defer directory", async () => {
    await put("hold/8BF6826AF21", queueFile({ sender: "a@example.com", recipients: ["held@example.org"] }));
    await put("defer/8/8BF6826AF21", "recipient=held@example.org\nstatus=4.4.1\nreason=greylisted\n\n");
    const view = await service.queueMessages("hold");
    expect(view.messages[0].recipients).toEqual([{ address: "held@example.org", status: "4.4.1", reason: "greylisted" }]);
  });

  it(`keeps the ${QUEUE_MESSAGES_LIMIT} newest and counts them all`, async () => {
    const count = QUEUE_MESSAGES_LIMIT + 2;
    for (let i = 0; i < count; i++) {
      await put(
        `deferred/A/A${String(i).padStart(9, "0")}`,
        queueFile({ sender: "a@example.com", recipients: ["b@example.org"], arrival: 1000 + i })
      );
    }
    const view = await service.queueMessages("deferred");
    expect(view.total).toBe(count);
    expect(view.messages).toHaveLength(QUEUE_MESSAGES_LIMIT);
    expect(view.messages[0].id).toBe(`A${String(count - 1).padStart(9, "0")}`);
    expect(view.messages.some((m) => m.id === "A000000000")).toBe(false);
  });

  it("reads a queue file again once it changed, and forgets one that left the queue", async () => {
    const path = "active/B1";
    await put(path, queueFile({ sender: "a@example.com", recipients: ["one@example.org"] }));
    expect((await service.queueMessages("active")).messages[0].recipients.map((r) => r.address)).toEqual(["one@example.org"]);

    await put(path, queueFile({ sender: "a@example.com", recipients: ["one@example.org", "two@example.org"] }));
    await utimes(join(spool, path), new Date(), new Date(Date.now() + 5_000));
    expect((await service.queueMessages("active")).messages[0].recipients.map((r) => r.address)).toEqual([
      "one@example.org",
      "two@example.org",
    ]);

    await rm(join(spool, path));
    expect(await service.queueMessages("active")).toMatchObject({ total: 0, messages: [], available: true });
  });

  it("uses the file date when a file being written has no arrival record yet", async () => {
    await put("incoming/C1", Buffer.alloc(0));
    const when = new Date("2026-09-29T10:00:00Z");
    await utimes(join(spool, "incoming/C1"), when, when);
    const view = await service.queueMessages("incoming");
    expect(view.messages[0]).toEqual({ id: "C1", arrivalTime: when.toISOString(), size: 0, sender: "", recipients: [] });
  });

  it("answers available false, with a warning, when the queue directory cannot be read", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    expect(await service.queueMessages("active")).toEqual({
      queue: "active",
      total: 0,
      limit: QUEUE_MESSAGES_LIMIT,
      messages: [],
      available: false,
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("still lists the messages when there is no defer directory", async () => {
    await put("deferred/D/D1", queueFile({ sender: "a@example.com", recipients: ["b@example.org"] }));
    const view = await service.queueMessages("deferred");
    expect(view.messages[0].recipients).toEqual([{ address: "b@example.org", status: null, reason: null }]);
  });
});
