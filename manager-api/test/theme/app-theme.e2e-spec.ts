import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AppThemeController } from "../../src/api/theme/app-theme.controller";
import { RootGuard } from "../../src/core/auth/root.guard";
import { ThemeService } from "../../src/core/theme/theme.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/theme";
const THEME = { light: { primary: "#2B7FFF" }, dark: { primary: "#00C950" } };

describe("AppThemeController (e2e: public read, root-only write)", () => {
  let h: Harness;
  const theme = { readApp: vi.fn(), saveApp: vi.fn(), readAccount: vi.fn(), saveAccount: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AppThemeController],
      providers: [RootGuard, { provide: ThemeService, useValue: theme }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    theme.readApp.mockReset().mockResolvedValue(THEME);
    theme.saveApp.mockReset().mockResolvedValue(THEME);
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;

  // The login screen wears this theme, so reading it cannot require a session.
  describe("GET is public", () => {
    it("answers with no token at all", async () => {
      const res = await api().get(base).expect(200);
      expect(res.body).toMatchObject(THEME);
    });

    it("carries the catalogue the API validates against", async () => {
      const res = await api().get(base).expect(200);
      expect(res.body.tokens.aliases).toContain("primary");
      expect(res.body.tokens.surfaces).toContain("--ui-bg");
    });

    it("answers an empty theme as an empty theme, not an error", async () => {
      theme.readApp.mockResolvedValue({ light: {}, dark: {} });
      const res = await api().get(base).expect(200);
      expect(res.body).toMatchObject({ light: {}, dark: {} });
    });
  });

  describe("PUT is root-only", () => {
    it("401 without a token", async () => {
      await api().put(base).send(THEME).expect(401);
      expect(theme.saveApp).not.toHaveBeenCalled();
    });

    it("403 for a non-root account", async () => {
      await api().put(base).set("Authorization", user()).send(THEME).expect(403);
      expect(theme.saveApp).not.toHaveBeenCalled();
    });

    it("saves as root", async () => {
      await api().put(base).set("Authorization", root()).send(THEME).expect(200);
      expect(theme.saveApp).toHaveBeenCalledWith(THEME);
    });

    it("accepts an empty theme, which is how a reset is written", async () => {
      await api().put(base).set("Authorization", root()).send({ light: {}, dark: {} }).expect(200);
      expect(theme.saveApp).toHaveBeenCalledWith({ light: {}, dark: {} });
    });
  });

  // The value lands in a stylesheet served to every page, so anything that is
  // not six hexadecimal digits has to be refused at the door.
  describe("validation (400)", () => {
    it.each([
      ["a token nobody knows", { light: { nonsense: "#FFFFFF" }, dark: {} }],
      ["a value that is not a colour", { light: { primary: "red" }, dark: {} }],
      ["a colour carrying css", { light: { primary: "#fff; content: url(x)" }, dark: {} }],
      ["a three digit colour", { light: { primary: "#FFF" }, dark: {} }],
      ["a colour without its hash", { light: { primary: "FFFFFF" }, dark: {} }],
      ["a mode nobody knows", { light: {}, dark: {}, sepia: { primary: "#FFFFFF" } }],
    ])("rejects %s", async (_case, body) => {
      await api()
        .put(base)
        .set("Authorization", root())
        .send(body as object)
        .expect(400);
      expect(theme.saveApp).not.toHaveBeenCalled();
    });
  });
});
