import { describe, it, expect } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy, type JwtPayload } from "../../src/core/auth/jwt/jwt.strategy";
import { entity } from "../helpers/mocks";

// setup.ts sets MANAGER_JWT_ACCESS_SECRET, so the constructor normally succeeds.
describe("JwtStrategy", () => {
  describe("construction", () => {
    it("throws when MANAGER_JWT_ACCESS_SECRET is missing", () => {
      const saved = process.env.MANAGER_JWT_ACCESS_SECRET;
      delete process.env.MANAGER_JWT_ACCESS_SECRET;
      try {
        expect(() => new JwtStrategy()).toThrow("MANAGER_JWT_ACCESS_SECRET is required");
      } finally {
        process.env.MANAGER_JWT_ACCESS_SECRET = saved;
      }
    });
  });

  describe("validate", () => {
    const strategy = new JwtStrategy();

    it("maps a payload to the request user, honouring isRoot: true", async () => {
      const user = await strategy.validate({ sub: "u1", email: "e@x.com", isRoot: true });
      expect(user).toEqual({ id: "u1", email: "e@x.com", isRoot: true });
    });

    it("defaults isRoot to false for a non-true value", async () => {
      const user = await strategy.validate({ sub: "u1", email: "e@x.com", isRoot: false });
      expect(user.isRoot).toBe(false);
      // a token that carries no isRoot claim (e.g. an old token) is also non-root
      const coerced = await strategy.validate(entity<JwtPayload>({ sub: "u1", email: "e@x.com" }));
      expect(coerced.isRoot).toBe(false);
    });

    it("rejects a payload with no subject", async () => {
      await expect(strategy.validate(entity<JwtPayload>({ email: "e@x.com" }))).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(strategy.validate(entity<JwtPayload>(null!))).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(strategy.validate({ sub: "", email: "e@x.com", isRoot: false })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
