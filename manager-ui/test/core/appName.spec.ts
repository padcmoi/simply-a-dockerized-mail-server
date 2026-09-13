import { describe, it, expect } from "vitest";
import { APP_NAME_DEFAULT, APP_NAME_MAX, clampAppName } from "~/utils/appName";

describe("clampAppName", () => {
  it("falls back to the product's name when nothing is set", () => {
    expect(clampAppName(undefined)).toBe(APP_NAME_DEFAULT);
    expect(clampAppName("   ")).toBe(APP_NAME_DEFAULT);
  });

  it("trims what the .env carries", () => {
    expect(clampAppName("  Mail Naskot ")).toBe("Mail Naskot");
  });

  it("caps the name so it fits the sidebar", () => {
    expect(clampAppName("x".repeat(40))).toHaveLength(APP_NAME_MAX);
  });
});
