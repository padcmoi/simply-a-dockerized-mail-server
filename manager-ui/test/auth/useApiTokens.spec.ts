import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useApiTokens } from "~/composables/useApiTokens";

// The composable's `onMounted(load)` is a deliberate no-op here (no component
// instance), so swallow just that expected Vue warning while keeping any other.
const realWarn = console.warn;
vi.spyOn(console, "warn").mockImplementation((msg: unknown, ...rest: unknown[]) => {
  if (typeof msg === "string" && msg.includes("onMounted is called when there is no active component")) return;
  realWarn(msg, ...rest);
});

// `useApi`, `useToast` and `useDataRefresh` are bare Nuxt auto-imports the
// composable calls; stub `useApi` with a spyable `call`, capture the toast, and
// hand back an inert refresh tick. `onMounted(load)` is a no-op outside a
// component instance, so load() never auto-runs here.
let call: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;

beforeEach(() => {
  call = vi.fn();
  add = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useToast", () => ({ add }));
  vi.stubGlobal("useDataRefresh", () => ({ tick: ref(0), bump: vi.fn() }));
});

function tokenItem(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "ci",
    clientId: "cid-1",
    allowedIps: null,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    createdAt: "2026-01-01",
    ...over,
  };
}

describe("useApiTokens.load", () => {
  it("populates tokens and clears loading on success", async () => {
    const rows = [tokenItem()];
    call.mockResolvedValue(rows);
    const { tokens, loading, load } = useApiTokens();
    await load();
    expect(tokens.value).toEqual(rows);
    expect(loading.value).toBe(false);
    expect(call).toHaveBeenCalledWith("/api-tokens");
  });

  it("toasts an error and leaves tokens untouched on failure", async () => {
    call.mockRejectedValue(new Error("nope"));
    const { tokens, loading, load } = useApiTokens();
    await load();
    expect(tokens.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(add).toHaveBeenCalledWith({ title: "apiTokens.toast.loadFailed", color: "error" });
  });
});

describe("useApiTokens.create", () => {
  it("prepends the created token with the client-side default fields", async () => {
    const created = {
      id: 9,
      name: "deploy",
      clientId: "cid-9",
      key: "secret-key",
      allowedIps: ["10.0.0.1"],
      expiresAt: "2027-01-01",
      createdAt: "2026-02-02",
    };
    call.mockResolvedValue(created);
    const { tokens, create } = useApiTokens();
    tokens.value = [tokenItem({ id: 1 })];
    const result = await create({ name: "deploy", allowedIps: ["10.0.0.1"] });

    expect(result).toBe(created);
    expect(tokens.value[0]).toEqual({
      id: 9,
      name: "deploy",
      clientId: "cid-9",
      allowedIps: ["10.0.0.1"],
      expiresAt: "2027-01-01",
      revokedAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      createdAt: "2026-02-02",
    });
    expect(tokens.value[1]!.id).toBe(1);
    expect(call).toHaveBeenCalledWith("/api-tokens", { method: "POST", body: { name: "deploy", allowedIps: ["10.0.0.1"] } });
  });
});

describe("useApiTokens.update", () => {
  it("PATCHes and assigns the input onto the matching row", async () => {
    call.mockResolvedValue(undefined);
    const { tokens, update } = useApiTokens();
    tokens.value = [tokenItem({ id: 1, name: "old" })];
    await update(1, { name: "new" });
    expect(tokens.value[0]!.name).toBe("new");
    expect(call).toHaveBeenCalledWith("/api-tokens/1", { method: "PATCH", body: { name: "new" } });
  });

  it("no-ops on the list when the id is absent", async () => {
    call.mockResolvedValue(undefined);
    const { tokens, update } = useApiTokens();
    tokens.value = [tokenItem({ id: 1, name: "old" })];
    await update(42, { name: "new" });
    expect(tokens.value[0]!.name).toBe("old");
  });
});

describe("useApiTokens.revoke / delete / abandon / regenerate", () => {
  it("revoke stamps revokedAt with an ISO timestamp", async () => {
    call.mockResolvedValue(undefined);
    const { tokens, revoke } = useApiTokens();
    tokens.value = [tokenItem({ id: 5, revokedAt: null })];
    await revoke(5);
    expect(tokens.value[0]!.revokedAt).toEqual(expect.any(String));
    expect(call).toHaveBeenCalledWith("/api-tokens/5/revoke", { method: "POST" });
  });

  it("deleteToken drops the row from the list", async () => {
    call.mockResolvedValue(undefined);
    const { tokens, deleteToken } = useApiTokens();
    tokens.value = [tokenItem({ id: 1 }), tokenItem({ id: 2 })];
    await deleteToken(1);
    expect(tokens.value.map((t) => t.id)).toEqual([2]);
    expect(call).toHaveBeenCalledWith("/api-tokens/1", { method: "DELETE" });
  });

  it("abandonToken revokes then deletes, and removes the row", async () => {
    call.mockResolvedValue(undefined);
    const { tokens, abandonToken } = useApiTokens();
    tokens.value = [tokenItem({ id: 3 })];
    await abandonToken(3);
    expect(tokens.value).toEqual([]);
    expect(call).toHaveBeenNthCalledWith(1, "/api-tokens/3/revoke", { method: "POST" });
    expect(call).toHaveBeenNthCalledWith(2, "/api-tokens/3", { method: "DELETE" });
  });

  it("regenerate swaps in the new clientId and returns the created token", async () => {
    const created = {
      id: 7,
      name: "ci",
      clientId: "cid-rotated",
      key: "new-secret",
      allowedIps: null,
      expiresAt: null,
      createdAt: "2026-03-03",
    };
    call.mockResolvedValue(created);
    const { tokens, regenerate } = useApiTokens();
    tokens.value = [tokenItem({ id: 7, clientId: "cid-old" })];
    const result = await regenerate(7);
    expect(result).toBe(created);
    expect(tokens.value[0]!.clientId).toBe("cid-rotated");
    expect(call).toHaveBeenCalledWith("/api-tokens/7/regenerate", { method: "POST" });
  });
});
