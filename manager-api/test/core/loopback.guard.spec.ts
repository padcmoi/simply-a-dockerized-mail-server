import { describe, it, expect } from "vitest";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { LoopbackGuard } from "../../src/core/auth/loopback.guard";

function contextOf(remoteAddress: string | undefined, headers: Record<string, string> = {}): ExecutionContext {
  const req = { socket: { remoteAddress }, headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext;
}

describe("LoopbackGuard", () => {
  const guard = new LoopbackGuard();

  for (const peer of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
    it(`lets ${peer} through`, () => {
      expect(guard.canActivate(contextOf(peer))).toBe(true);
    });
  }

  for (const peer of ["172.18.0.5", "::ffff:172.18.0.5", "10.0.0.1", "192.168.1.10", "203.0.113.7", "127.0.0.2", "", undefined]) {
    it(`refuses ${String(peer)}`, () => {
      expect(() => guard.canActivate(contextOf(peer))).toThrow(ForbiddenException);
    });
  }

  it("reads the peer of the connection, never the address a header claims", () => {
    expect(() => guard.canActivate(contextOf("172.18.0.5", { "x-forwarded-for": "127.0.0.1" }))).toThrow(ForbiddenException);
  });

  for (const header of ["x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded"]) {
    it(`refuses a loopback connection carrying ${header}`, () => {
      expect(() => guard.canActivate(contextOf("127.0.0.1", { [header]: "203.0.113.7" }))).toThrow(ForbiddenException);
    });
  }
});
