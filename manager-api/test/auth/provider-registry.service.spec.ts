import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import passport from "passport";
import { ProviderRegistryService } from "../../src/core/auth/passport/provider-registry.service";
import { encryptSecret } from "../../src/core/auth/api-token/api-token.cipher";
import type { PassportProviderCredential } from "../../src/core/entities/passport-provider-credential.entity";
import { entity, repoMock } from "../helpers/mocks";

const PEPPER = "test-pepper";

function row(over: Partial<PassportProviderCredential> = {}) {
  return entity<PassportProviderCredential>({
    provider: "google",
    clientId: "client-id",
    clientSecretCipher: encryptSecret("client-secret", PEPPER),
    enabled: 1,
    ...over,
  });
}

// The registry hands its strategies to Passport itself, so the two entry points
// it uses are spied on rather than letting real strategies register globally.
function spyOnPassport() {
  return {
    use: vi.spyOn(passport, "use").mockReturnValue(passport),
    unuse: vi.spyOn(passport, "unuse").mockReturnValue(passport),
  };
}

describe("ProviderRegistryService", () => {
  let credentials: ReturnType<typeof repoMock<PassportProviderCredential>>;
  let svc: ProviderRegistryService;
  let spies: ReturnType<typeof spyOnPassport>;

  beforeEach(() => {
    process.env.MANAGER_API_TOKEN_PEPPER = PEPPER;
    credentials = repoMock<PassportProviderCredential>();
    svc = new ProviderRegistryService(credentials);
    spies = spyOnPassport();
  });

  afterEach(() => {
    spies.use.mockRestore();
    spies.unuse.mockRestore();
  });

  it("registers a configured and enabled provider with Passport under its own id", async () => {
    credentials.find.mockResolvedValue([row()]);

    const state = await svc.reload();

    expect(spies.use).toHaveBeenCalledWith("google", expect.anything());
    expect(svc.isEnabled("google")).toBe(true);
    expect(state).toEqual([{ id: "google", label: "Google", configured: true, enabled: true, clientId: "client-id" }]);
  });

  it("unregisters a provider that is configured but switched off", async () => {
    credentials.find.mockResolvedValue([row({ enabled: 0 })]);

    const state = await svc.reload();

    expect(spies.use).not.toHaveBeenCalled();
    expect(spies.unuse).toHaveBeenCalledWith("google");
    expect(state[0]).toMatchObject({ configured: true, enabled: false });
  });

  it("reports a provider with no row as never configured", async () => {
    credentials.find.mockResolvedValue([]);

    const state = await svc.reload();

    expect(state).toEqual([{ id: "google", label: "Google", configured: false, enabled: false, clientId: "" }]);
    expect(svc.isEnabled("google")).toBe(false);
  });

  it("treats a secret it cannot decrypt as no credentials at all", async () => {
    credentials.find.mockResolvedValue([row({ clientSecretCipher: "v1$bad$bad$bad" })]);

    const state = await svc.reload();

    expect(state[0]).toMatchObject({ configured: false, enabled: false });
    expect(spies.use).not.toHaveBeenCalled();
  });

  it("treats a blank client id as no credentials at all", async () => {
    credentials.find.mockResolvedValue([row({ clientId: "   " })]);

    expect((await svc.reload())[0]).toMatchObject({ configured: false });
  });

  it("survives a boot before the table exists rather than taking the API down", async () => {
    credentials.find.mockRejectedValue(new Error("no such table"));

    const state = await svc.reload();

    expect(state[0]).toMatchObject({ configured: false });
  });

  it("swallows an unuse for a provider that was never registered", async () => {
    credentials.find.mockResolvedValue([]);
    spies.unuse.mockImplementation(() => {
      throw new Error("Unknown strategy");
    });

    await expect(svc.reload()).resolves.toBeDefined();
  });

  it("loads once at boot", async () => {
    credentials.find.mockResolvedValue([row()]);
    await svc.onModuleInit();
    expect(credentials.find).toHaveBeenCalledTimes(1);
    expect(spies.use).toHaveBeenCalledWith("google", expect.anything());
  });

  it("seals the secret on write and re-registers at once", async () => {
    credentials.findOne.mockResolvedValue(null);
    credentials.find.mockResolvedValue([row()]);

    await svc.upsert("google", { clientId: "new-id", clientSecret: "new-secret", enabled: true });

    const saved = credentials.create.mock.calls[0][0] as PassportProviderCredential;
    expect(saved.clientId).toBe("new-id");
    expect(saved.clientSecretCipher).not.toContain("new-secret");
    expect(saved.enabled).toBe(1);
    expect(spies.use).toHaveBeenCalledWith("google", expect.anything());
  });

  it("keeps the stored secret when a later write omits it", async () => {
    const existing = row({ clientSecretCipher: "sealed-already" });
    credentials.findOne.mockResolvedValue(existing);
    credentials.find.mockResolvedValue([existing]);

    await svc.upsert("google", { clientId: "other-id", enabled: false });

    const saved = credentials.create.mock.calls[0][0] as PassportProviderCredential;
    expect(saved.clientSecretCipher).toBe("sealed-already");
    expect(saved.enabled).toBe(0);
  });

  it("refuses a first configuration with no secret", async () => {
    credentials.findOne.mockResolvedValue(null);
    await expect(svc.upsert("google", { clientId: "id", enabled: true })).rejects.toThrow(/client secret is required/i);
  });

  it("refuses a provider this build does not know", async () => {
    await expect(svc.upsert("nope", { clientId: "id", clientSecret: "s", enabled: true })).rejects.toThrow(/Unknown provider/);
  });

  it("forgets a provider, row and strategy alike", async () => {
    credentials.find.mockResolvedValue([]);

    await svc.remove("google");

    expect(credentials.delete).toHaveBeenCalledWith({ provider: "google" });
    expect(spies.unuse).toHaveBeenCalledWith("google");
  });

  it("refuses to work without the pepper that seals the secret", async () => {
    delete process.env.MANAGER_API_TOKEN_PEPPER;
    credentials.find.mockResolvedValue([row()]);
    await expect(svc.reload()).rejects.toThrow(/MANAGER_API_TOKEN_PEPPER/);
  });

  it("lists a provider it has never read as unconfigured", () => {
    expect(svc.list()).toEqual([{ id: "google", label: "Google", configured: false, enabled: false, clientId: "" }]);
  });
});
