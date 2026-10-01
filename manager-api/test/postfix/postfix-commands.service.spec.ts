import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { mkdtemp, readdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { PostfixCommandsService } from "../../src/core/postfix/postfix-commands.service";

class TestCommandsService extends PostfixCommandsService {
  constructor(
    protected readonly dir: string,
    protected readonly timeoutMs: number
  ) {
    super();
  }
}

describe("PostfixCommandsService", () => {
  let dir: string;
  const stops: (() => void)[] = [];

  const fakeWatcher = (answer: (command: Record<string, unknown>) => Record<string, unknown> | null) => {
    let stop = false;
    stops.push(() => {
      stop = true;
    });
    const own = dir;
    const seen: Record<string, unknown>[] = [];
    const loop = async () => {
      while (!stop) {
        for (const name of await readdir(own).catch(() => [] as string[])) {
          if (stop) break;
          if (!name.endsWith(".req.json")) continue;
          const raw = await readFile(join(own, name), "utf8").catch(() => null);
          if (raw === null) continue;
          const command = JSON.parse(raw) as Record<string, unknown>;
          seen.push(command);
          await rm(join(own, name), { force: true });
          const result = answer(command);
          if (result)
            await writeFile(join(own, name.replace(".req.json", ".res.json")), JSON.stringify(result)).catch(() => undefined);
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };
    void loop();
    return seen;
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "postfix-commands-"));
  });
  afterEach(async () => {
    stops.splice(0).forEach((halt) => halt());
    await rm(dir, { recursive: true, force: true });
  });

  it("drops the command for the watcher and resolves once it deleted the message, leaving no file behind", async () => {
    const seen = fakeWatcher(() => ({ status: "deleted", message: "ok" }));
    await new TestCommandsService(dir, 3_000).deleteMessage("deferred", "60CD226AED9");
    expect(seen).toEqual([{ action: "delete", queue: "deferred", queueId: "60CD226AED9" }]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("answers 404 when the watcher did not find the message", async () => {
    fakeWatcher(() => ({ status: "not-found", message: "60CD226AED9 is not in the deferred queue" }));
    await expect(new TestCommandsService(dir, 3_000).deleteMessage("deferred", "60CD226AED9")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("answers 503 when the watcher refused the command", async () => {
    fakeWatcher(() => ({ status: "invalid", message: "unknown action" }));
    await expect(new TestCommandsService(dir, 3_000).deleteMessage("hold", "ABCDEF")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("answers 503 and takes its command back when nothing answers in time", async () => {
    await expect(new TestCommandsService(dir, 400).deleteMessage("hold", "ABCDEF")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect((await readdir(dir)).filter((name) => name.endsWith(".req.json"))).toEqual([]);
  });

  it("drops a retry command and resolves once the watcher scheduled the delivery, leaving no file behind", async () => {
    const seen = fakeWatcher(() => ({ status: "retried", message: "ok" }));
    await new TestCommandsService(dir, 3_000).retryMessage("hold", "60CD226AED9");
    expect(seen).toEqual([{ action: "retry", queue: "hold", queueId: "60CD226AED9" }]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("answers 404 on a retry when the watcher did not find the message", async () => {
    fakeWatcher(() => ({ status: "not-found", message: "60CD226AED9 is not in the deferred queue" }));
    await expect(new TestCommandsService(dir, 3_000).retryMessage("deferred", "60CD226AED9")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("answers 503 on a retry the watcher answered as a deletion", async () => {
    fakeWatcher(() => ({ status: "deleted", message: "ok" }));
    await expect(new TestCommandsService(dir, 3_000).retryMessage("deferred", "60CD226AED9")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
