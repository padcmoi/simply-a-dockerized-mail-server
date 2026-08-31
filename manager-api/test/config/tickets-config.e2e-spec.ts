import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { TicketsConfigController } from "../../src/api/config/tickets-config.controller";
import { RootGuard } from "../../src/core/auth/root.guard";
import { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/tickets";
const SETTINGS = { ticketResourcesRequired: true };

describe("TicketsConfigController (e2e: root-only /config namespace)", () => {
  let h: Harness;
  const settings = { get: vi.fn(), update: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [TicketsConfigController],
      providers: [RootGuard, { provide: AppSettingsService, useValue: settings }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    settings.get.mockReset().mockReturnValue(SETTINGS);
    settings.update.mockReset().mockResolvedValue(SETTINGS);
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const attach = (t: request.Test, auth?: string) => (auth ? t.set("Authorization", auth) : t);

  const routes: { name: string; send: (auth?: string) => request.Test }[] = [
    { name: "GET", send: (a) => attach(api().get(base), a) },
    { name: "PUT", send: (a) => attach(api().put(base).send(SETTINGS), a) },
  ];

  // What a ticket must name is a server-wide decision, so holding every ticket
  // permission there is does not open this namespace: it is root and nothing
  // else, like the rest of /config.
  describe("root-only guard", () => {
    for (const r of routes) {
      it(`401 without a token -- ${r.name}`, async () => {
        await r.send().expect(401);
      });
      it(`403 for a non-root account -- ${r.name}`, async () => {
        await r.send(user()).expect(403);
      });
    }

    it("403 for an account holding every ticket permission there is", async () => {
      h.cpg.grantGlobal("tickets", "access", "list-tickets", "view-ticket", "create-ticket", "reply-ticket", "handle-ticket");
      await api().get(base).set("Authorization", user()).expect(403);
    });
  });

  describe("as root", () => {
    it("GET returns the setting", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual(SETTINGS);
    });

    it("PUT turns it off", async () => {
      const body = { ticketResourcesRequired: false };
      await api().put(base).set("Authorization", root()).send(body).expect(200);
      expect(settings.update).toHaveBeenCalledWith(body);
    });

    it("PUT turns it back on", async () => {
      await api().put(base).set("Authorization", root()).send({ ticketResourcesRequired: true }).expect(200);
      expect(settings.update).toHaveBeenCalledWith({ ticketResourcesRequired: true });
    });
  });

  describe("validation (400)", () => {
    it.each([
      ["a string", "true"],
      ["a number", 1],
      ["null", null],
    ])("rejects %s rather than coercing it", async (_case, value) => {
      await api().put(base).set("Authorization", root()).send({ ticketResourcesRequired: value }).expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });

    it("rejects a missing field rather than storing undefined", async () => {
      await api().put(base).set("Authorization", root()).send({}).expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });
  });
});
