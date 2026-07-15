import { describe, it, expect, vi } from "vitest";

// child_process is mocked so no openssl process is spawned. promisify(execFile)
// with a plain mock (no util.promisify.custom symbol) resolves with the value
// passed as the callback's second argument, so the mock hands back { stdout }.
vi.mock("child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (e: null, r: { stdout: string; stderr: string }) => void) =>
    cb(null, { stdout: "$6$deadbeef$hashedpassword\n", stderr: "" })
  ),
}));

import { execFile } from "child_process";
import { sha512crypt } from "../../src/core/common/sha512-crypt";

describe("sha512crypt", () => {
  it("hashes via `openssl passwd -6` and trims the output", async () => {
    const res = await sha512crypt("s3cret");
    expect(res).toBe("$6$deadbeef$hashedpassword");
  });

  it("passes a 16-char base64ish salt with only [a-zA-Z0-9./]", async () => {
    await sha512crypt("pw");
    const [cmd, args] = vi.mocked(execFile).mock.calls.at(-1)!;
    expect(cmd).toBe("openssl");
    expect((args as string[])[0]).toBe("passwd");
    expect((args as string[])[1]).toBe("-6");
    expect((args as string[])[2]).toBe("-salt");
    const salt = (args as string[])[3];
    expect(salt.length).toBeLessThanOrEqual(16);
    expect(salt).toMatch(/^[a-zA-Z0-9./]*$/);
    expect((args as string[])[4]).toBe("pw");
  });
});
