import { HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { join } from "path";
import { POSTFIX_MANAGED_PATH } from "./postfix-settings.service";
import type { QueueName } from "./postfix.service";

export const QUEUE_ID_PATTERN = /^[0-9A-Za-z]{6,32}$/;
export const RETRYABLE_QUEUES = ["deferred", "hold"] as const;
export type RetryableQueue = (typeof RETRYABLE_QUEUES)[number];

type Command =
  { action: "delete"; queue: QueueName; queueId: string } | { action: "retry"; queue: RetryableQueue; queueId: string };

interface CommandResult {
  status: "deleted" | "retried" | "not-found" | "invalid";
  message: string;
}

@Injectable()
export class PostfixCommandsService {
  protected readonly dir: string = join(POSTFIX_MANAGED_PATH, "commands");
  protected readonly timeoutMs: number = 10_000;
  private readonly pollMs = 200;

  async deleteMessage(queue: QueueName, queueId: string): Promise<void> {
    const result = await this.run({ action: "delete", queue, queueId });
    if (result.status === "not-found") throw new NotFoundException(result.message);
    if (result.status !== "deleted") throw new ServiceUnavailableException(result.message);
  }

  async retryMessage(queue: RetryableQueue, queueId: string): Promise<void> {
    const result = await this.run({ action: "retry", queue, queueId });
    if (result.status === "not-found") throw new NotFoundException(result.message);
    if (result.status !== "retried") throw new ServiceUnavailableException(result.message);
  }

  private async run(command: Command): Promise<CommandResult> {
    const id = randomUUID();
    const request = join(this.dir, `${id}.req.json`);
    const response = join(this.dir, `${id}.res.json`);
    await mkdir(this.dir, { recursive: true });
    const tmp = join(this.dir, `.${id}.req.tmp`);
    await writeFile(tmp, JSON.stringify(command), { mode: 0o644 });
    await rename(tmp, request);

    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
      const raw = await readFile(response, "utf8").catch(() => null);
      if (raw === null) continue;
      await rm(response, { force: true });
      try {
        return JSON.parse(raw) as CommandResult;
      } catch {
        break;
      }
    }
    await rm(request, { force: true });
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: "Postfix did not answer the command in time",
    });
  }
}
