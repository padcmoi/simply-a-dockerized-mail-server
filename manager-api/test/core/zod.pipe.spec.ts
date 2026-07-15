import { describe, it, expect } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../../src/core/common/zod.pipe";

const schema = z.object({ a: z.number(), b: z.string().optional() });

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(schema);

  it("returns the parsed value when validation succeeds", () => {
    expect(pipe.transform({ a: 1, b: "x" })).toEqual({ a: 1, b: "x" });
  });

  it("throws a BadRequestException on invalid input", () => {
    expect(() => pipe.transform({ a: "not-a-number" })).toThrow(BadRequestException);
  });

  it("carries the translation code and zod issues in the response body", () => {
    try {
      pipe.transform({ a: "nope" });
      expect.unreachable("pipe should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as { code: string; message: string; issues: unknown[] };
      expect(body.code).toBe("validation.failed");
      expect(body.message).toBe("Validation failed");
      expect(Array.isArray(body.issues)).toBe(true);
      expect(body.issues.length).toBeGreaterThan(0);
    }
  });
});
