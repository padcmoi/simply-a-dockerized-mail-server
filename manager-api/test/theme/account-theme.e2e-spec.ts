import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AccountThemeController } from "../../src/api/theme/account-theme.controller";
import { ThemeService } from "../../src/core/theme/theme.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/my-space/theme";
const THEME = { light: { primary: "#2B7FFF" }, dark: { "--ui-bg": "#0F172B" } };

describe("AccountThemeController (e2e: authenticated, self-scoped)", () => {
  let h: Harness;
  const theme = { readApp: vi.fn(), saveApp: vi.fn(), readAccount: vi.fn(), saveAccount: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AccountThemeController],
      providers: [{ provide: ThemeService, useValue: theme }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    theme.readAccount.mockReset().mockResolvedValue(THEME);
    theme.saveAccount.mockReset().mockResolvedValue(THEME);
  });

  const api = () => request(h.app.getHttpServer());
  const user = () => `Bearer ${h.token(USER)}`;
  const root = () => `Bearer ${h.token(ROOT)}`;

  describe("authentication", () => {
    it("401 on GET without a token", async () => {
      await api().get(base).expect(401);
      expect(theme.readAccount).not.toHaveBeenCalled();
    });

    it("401 on PUT without a token", async () => {
      await api().put(base).send(THEME).expect(401);
      expect(theme.saveAccount).not.toHaveBeenCalled();
    });
  });

  // Nothing to authorize beyond the token: the account it names is the only one
  // these routes can reach, so a plain user gets in and reaches only themselves.
  describe("scoped to the caller", () => {
    it("reads with the id from the token, holding no permission at all", async () => {
      const res = await api().get(base).set("Authorization", user()).expect(200);
      expect(res.body).toEqual(THEME);
      expect(theme.readAccount).toHaveBeenCalledWith(USER.id);
    });

    it("writes against the id from the token", async () => {
      await api().put(base).set("Authorization", user()).send(THEME).expect(200);
      expect(theme.saveAccount).toHaveBeenCalledWith(USER.id, THEME);
    });

    it("gives root their own theme, not a way into someone else's", async () => {
      await api().get(base).set("Authorization", root()).expect(200);
      expect(theme.readAccount).toHaveBeenCalledWith(ROOT.id);
    });

    it("accepts an empty theme, which is how a reset is written", async () => {
      await api().put(base).set("Authorization", user()).send({ light: {}, dark: {} }).expect(200);
      expect(theme.saveAccount).toHaveBeenCalledWith(USER.id, { light: {}, dark: {} });
    });
  });

  describe("validation (400)", () => {
    it.each([
      ["a token nobody knows", { light: { nonsense: "#FFFFFF" }, dark: {} }],
      ["a value that is not a colour", { light: { primary: "red" }, dark: {} }],
      ["a colour carrying css", { light: { "--ui-bg": "#fff; content: url(x)" }, dark: {} }],
    ])("rejects %s", async (_case, body) => {
      await api()
        .put(base)
        .set("Authorization", user())
        .send(body as object)
        .expect(400);
      expect(theme.saveAccount).not.toHaveBeenCalled();
    });
  });
});
