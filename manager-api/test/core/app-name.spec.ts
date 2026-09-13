import { describe, it, expect, afterEach } from "vitest";
import { APP_NAME_DEFAULT, APP_NAME_MAX, appName } from "../../src/core/common/app-name";

afterEach(() => {
  delete process.env.MANAGER_APP_NAME;
});

describe("appName", () => {
  it("falls back to the product's name when the .env says nothing", () => {
    delete process.env.MANAGER_APP_NAME;
    expect(appName()).toBe(APP_NAME_DEFAULT);
    process.env.MANAGER_APP_NAME = "   ";
    expect(appName()).toBe(APP_NAME_DEFAULT);
  });

  it("reads the .env, trimmed", () => {
    process.env.MANAGER_APP_NAME = "  Mail Naskot ";
    expect(appName()).toBe("Mail Naskot");
  });

  it("caps the name so it fits the sidebar", () => {
    process.env.MANAGER_APP_NAME = "x".repeat(40);
    expect(appName()).toHaveLength(APP_NAME_MAX);
  });
});
