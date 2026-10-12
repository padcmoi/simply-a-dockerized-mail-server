import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { Readable } from "stream";
import { BrandingController } from "../../src/api/branding/branding.controller";
import { BrandingService } from "../../src/core/branding/branding.service";
import { buildHarness, ROOT, type Harness } from "../helpers/e2e";

const base = "/api/v1/branding";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script></svg>';

describe("BrandingController (e2e: public, like the sign-in screen that shows it)", () => {
  let h: Harness;
  const branding = { state: vi.fn(), open: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [BrandingController],
      providers: [{ provide: BrandingService, useValue: branding }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    branding.state.mockReset().mockResolvedValue({ custom: true, version: "3f9a1c0b7d2e", favicon: "9c41d2aa07be" });
    branding.open.mockReset().mockImplementation(async () => ({ size: Buffer.byteLength(SVG), stream: Readable.from([SVG]) }));
  });

  const api = () => request(h.app.getHttpServer());

  describe("GET /branding", () => {
    it("answers with no token at all", async () => {
      const res = await api().get(base).expect(200);
      expect(res.body).toEqual({ custom: true, version: "3f9a1c0b7d2e", favicon: "9c41d2aa07be" });
    });

    it("answers the same to a signed-in account", async () => {
      await api()
        .get(base)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .expect(200);
    });

    it("says so when the server carries no custom file", async () => {
      branding.state.mockResolvedValue({ custom: false, version: null, favicon: null });
      const res = await api().get(base).expect(200);
      expect(res.body).toEqual({ custom: false, version: null, favicon: null });
    });
  });

  describe("GET /branding/:kind", () => {
    for (const kind of ["icon", "logo", "favicon"] as const) {
      it(`serves the ${kind} with no token, as an image nothing can run from`, async () => {
        const res = await api()
          .get(`${base}/${kind}`)
          .buffer(true)
          .parse((r, done) => {
            const chunks: Buffer[] = [];
            r.on("data", (chunk: Buffer) => chunks.push(chunk));
            r.on("end", () => done(null, Buffer.concat(chunks)));
          });
        expect(res.status).toBe(200);
        expect(branding.open).toHaveBeenCalledWith(kind);
        expect(res.headers["content-type"]).toContain("image/svg+xml");
        expect(res.headers["content-security-policy"]).toContain("sandbox");
        expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.headers["cache-control"]).toBe("public, max-age=300");
        expect((res.body as Buffer).toString("utf8")).toBe(SVG);
      });
    }

    it("404 when the server does not carry that custom file", async () => {
      branding.open.mockResolvedValue(null);
      await api().get(`${base}/logo`).expect(404);
      await api().get(`${base}/favicon`).expect(404);
    });

    for (const kind of ["favicon.ico", "..%2F.env", ".env", "constructor", "toString", "custom-mail-logo.svg"]) {
      it(`404 for ${kind}, nothing looked up`, async () => {
        await api().get(`${base}/${kind}`).expect(404);
        expect(branding.open).not.toHaveBeenCalled();
      });
    }
  });
});
