import { describe, it, expect } from "vitest";
import { paginationQuerySchema, resolveSortColumn } from "../../src/core/common/pagination.validation";

describe("paginationQuerySchema", () => {
  it("coerces and trims a full valid query", () => {
    expect(paginationQuerySchema.parse({ limit: "25", offset: "5", search: "  hi ", sortDir: "asc", sortBy: " name " })).toEqual({
      limit: 25,
      offset: 5,
      search: "hi",
      sortDir: "asc",
      sortBy: "name",
    });
  });

  it("applies defaults and leaves optionals absent", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ offset: 0, sortDir: "desc" });
  });

  it.each([10, 25, 50])("accepts limit %i", (limit) => {
    expect(paginationQuerySchema.safeParse({ limit }).success).toBe(true);
  });

  it.each([7, 0, 100, "abc"])("rejects an out-of-set or non-numeric limit (%s)", (limit) => {
    expect(paginationQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it("rejects a negative offset", () => {
    expect(paginationQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it("rejects a blank or whitespace-only search", () => {
    expect(paginationQuerySchema.safeParse({ search: "" }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ search: "   " }).success).toBe(false);
  });

  it("rejects a search longer than 200 chars", () => {
    expect(paginationQuerySchema.safeParse({ search: "a".repeat(201) }).success).toBe(false);
  });

  it("rejects a sortDir outside the enum", () => {
    expect(paginationQuerySchema.safeParse({ sortDir: "sideways" }).success).toBe(false);
  });

  it("rejects a sortBy longer than 50 chars", () => {
    expect(paginationQuerySchema.safeParse({ sortBy: "a".repeat(51) }).success).toBe(false);
  });
});

describe("resolveSortColumn", () => {
  const allowed = ["sender", "createdAt"] as const;

  it("returns the requested column when it is allowed", () => {
    expect(resolveSortColumn("sender", allowed, "createdAt")).toBe("sender");
  });

  it("falls back when the requested column is unknown", () => {
    expect(resolveSortColumn("bogus", allowed, "createdAt")).toBe("createdAt");
  });

  it("falls back when nothing is requested", () => {
    expect(resolveSortColumn(undefined, allowed, "createdAt")).toBe("createdAt");
  });
});
