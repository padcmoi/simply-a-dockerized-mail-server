import { describe, it, expect, vi, beforeEach } from "vitest";
import { InfoController } from "../../src/api/info/info.controller";
import { InfoService } from "../../src/api/info/info.service";
import { providerMock } from "../helpers/mocks";

// The VERSION file is written on the host by service.sh and baked into the
// image, so it is never there under vitest: readFileSync is driven per test.
const state = vi.hoisted(() => ({ read: null as (() => string) | null }));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => {
    if (!state.read) throw new Error("ENOENT");
    return state.read();
  }),
}));

describe("InfoService", () => {
  beforeEach(() => {
    state.read = null;
  });

  it("reads the tag the image was built from", () => {
    state.read = () => "v2.0.0-rc.2\n";
    expect(new InfoService().codeVersion()).toBe("v2.0.0-rc.2");
  });

  it("answers unknown when the file is missing, rather than failing to boot", () => {
    state.read = null;
    expect(new InfoService().codeVersion()).toBe("unknown");
  });

  it("answers unknown on an empty file", () => {
    state.read = () => "   \n";
    expect(new InfoService().codeVersion()).toBe("unknown");
  });

  it("reads the file once, at construction", () => {
    state.read = () => "v1.0.0";
    const svc = new InfoService();
    state.read = () => "v9.9.9";
    expect(svc.codeVersion()).toBe("v1.0.0");
    expect(svc.codeVersion()).toBe("v1.0.0");
  });
});

describe("InfoController", () => {
  it("answers the version under code_version", () => {
    const svc = providerMock<InfoService>({ codeVersion: vi.fn(() => "v2.0.0-rc.2") });
    expect(new InfoController(svc).get()).toEqual({ code_version: "v2.0.0-rc.2" });
  });
});
