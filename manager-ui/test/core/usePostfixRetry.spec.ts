import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useBulkRun } from "~/composables/useBulkRun";
import { usePostfixRetry } from "~/composables/usePostfixRetry";

let root: boolean;
let granted: string[];
let call: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;

beforeEach(() => {
  root = false;
  granted = [];
  call = vi.fn(async () => undefined);
  add = vi.fn();
  vi.stubGlobal("usePermissions", () => ({
    isRoot: ref(root),
    hasGlobal: (resource: string, action: string) => granted.includes(`${resource}:${action}`),
  }));
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useApiError", () => ({ apiErrorMessage: (err: unknown) => String(err) }));
  vi.stubGlobal("useToast", () => ({ add }));
  vi.stubGlobal("useBulkRun", useBulkRun);
});

describe("usePostfixRetry.canRetry", () => {
  it("is offered to root on the deferred and the hold queues only", () => {
    root = true;
    expect(usePostfixRetry(() => "deferred", vi.fn()).canRetry.value).toBe(true);
    expect(usePostfixRetry(() => "hold", vi.fn()).canRetry.value).toBe(true);
    expect(usePostfixRetry(() => "active", vi.fn()).canRetry.value).toBe(false);
    expect(usePostfixRetry(() => "incoming", vi.fn()).canRetry.value).toBe(false);
    expect(usePostfixRetry(() => undefined, vi.fn()).canRetry.value).toBe(false);
  });

  it("asks a non-root account for access and the retry action, the purge action giving nothing", () => {
    granted = ["postfix:access", "postfix:purge-postfix-queue-message"];
    expect(usePostfixRetry(() => "deferred", vi.fn()).canRetry.value).toBe(false);
    granted = ["postfix:retry-postfix-queue-message"];
    expect(usePostfixRetry(() => "deferred", vi.fn()).canRetry.value).toBe(false);
    granted = ["postfix:access", "postfix:retry-postfix-queue-message"];
    expect(usePostfixRetry(() => "deferred", vi.fn()).canRetry.value).toBe(true);
  });
});

describe("usePostfixRetry.retry", () => {
  it("sends one request per message and reloads once", async () => {
    root = true;
    const onRetried = vi.fn();
    const done = await usePostfixRetry(() => "hold", onRetried).retry(["AAA111", "BBB222"]);
    expect(call.mock.calls).toEqual([
      ["/postfix/queue/hold/messages/AAA111/retry", { method: "POST" }],
      ["/postfix/queue/hold/messages/BBB222/retry", { method: "POST" }],
    ]);
    expect(done).toEqual(["AAA111", "BBB222"]);
    expect(onRetried).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ color: "success" }));
  });

  it("returns the messages that went through and reports the others", async () => {
    root = true;
    call.mockImplementation(async (path: string) => {
      if (path.includes("BBB222")) throw new Error("gone");
    });
    const done = await usePostfixRetry(() => "deferred", vi.fn()).retry(["AAA111", "BBB222"]);
    expect(done).toEqual(["AAA111"]);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ color: "error" }));
  });

  it("sends nothing from a queue that cannot be retried, nor without the right", async () => {
    root = true;
    expect(await usePostfixRetry(() => "active", vi.fn()).retry(["AAA111"])).toEqual([]);
    root = false;
    expect(await usePostfixRetry(() => "deferred", vi.fn()).retry(["AAA111"])).toEqual([]);
    expect(call).not.toHaveBeenCalled();
  });
});
