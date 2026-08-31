import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";
import { usePaginatedList, LIST_LIMIT_STORAGE_KEY } from "~/composables/usePaginatedList";

// usePaginatedList builds its state on top of useAsyncData. We replace that with
// a stub that (a) hands back controllable data/status refs and (b) captures the
// fetcher so we can invoke it and assert the query string it builds. `until`,
// `useApi` and `useToast` are the other bare auto-imports it reaches for.
let data: ReturnType<typeof ref>;
let status: ReturnType<typeof ref>;
let capturedFetcher: () => Promise<unknown>;
let call: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;
const refresh = vi.fn();

beforeEach(() => {
  data = ref(null);
  status = ref("idle");
  call = vi.fn().mockResolvedValue({ items: [], total: 0 });
  add = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useToast", () => ({ add }));
  vi.stubGlobal("useDataRefresh", () => ({ tick: ref(0), bump: vi.fn() }));
  // Resolve immediately to the getter's current value (the real `until` suspends
  // until truthy; that suspend behaviour is delegated, not re-tested here).
  vi.stubGlobal("until", (getter: () => unknown) => ({ toBeTruthy: async () => getter() }));
  vi.stubGlobal("useAsyncData", (_key: string, fetcher: () => Promise<unknown>) => {
    capturedFetcher = fetcher;
    return { data, status, pending: ref(false), error: ref(null), refresh, execute: vi.fn() };
  });
});

describe("usePaginatedList state", () => {
  it("exports the shared list-limit storage key", () => {
    expect(LIST_LIMIT_STORAGE_KEY).toBe("manager-list-limit");
  });

  it("seeds page/limit/search/sort defaults", () => {
    const l = usePaginatedList("k", "/things", "name");
    expect(l.page.value).toBe(1);
    expect(l.limit.value).toBe(10); // useLocalStorage default in the harness
    expect(l.search.value).toBe("");
    expect(l.sortBy.value).toBe("name");
    expect(l.sortDir.value).toBe("desc");
  });

  it("unwraps items/total from the response, defaulting to empty/0", () => {
    const l = usePaginatedList("k", "/things", "name");
    expect(l.items.value).toEqual([]);
    expect(l.total.value).toBe(0);
    data.value = { items: [{ id: 1 }, { id: 2 }], total: 42 };
    expect(l.items.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(l.total.value).toBe(42);
  });

  it("derives loading from a pending status only", () => {
    const l = usePaginatedList("k", "/things", "name");
    expect(l.loading.value).toBe(false);
    status.value = "pending";
    expect(l.loading.value).toBe(true);
    status.value = "success";
    expect(l.loading.value).toBe(false);
  });

  it("flips hasLoadedOnce true after the first settle and never back", async () => {
    const l = usePaginatedList("k", "/things", "name");
    expect(l.hasLoadedOnce.value).toBe(false);
    status.value = "success";
    await nextTick();
    expect(l.hasLoadedOnce.value).toBe(true);
    status.value = "pending";
    await nextTick();
    expect(l.hasLoadedOnce.value).toBe(true);
  });

  it("also settles hasLoadedOnce on an error status", async () => {
    const l = usePaginatedList("k", "/things", "name");
    status.value = "error";
    await nextTick();
    expect(l.hasLoadedOnce.value).toBe(true);
  });

  it("resets to page 1 when the debounced search changes", async () => {
    const l = usePaginatedList("k", "/things", "name");
    l.page.value = 4;
    l.search.value = "needle";
    await nextTick(); // watch(search) -> applyDebouncedSearch (identity stub)
    expect(l.page.value).toBe(1);
  });

  it("exposes refresh as `load`", () => {
    const l = usePaginatedList("k", "/things", "name");
    expect(l.load).toBe(refresh);
  });
});

describe("usePaginatedList query building", () => {
  it("builds limit/offset/sortDir/sortBy for the default page", async () => {
    const l = usePaginatedList("k", "/things", "name");
    void l;
    await capturedFetcher();
    expect(call).toHaveBeenCalledWith("/things?limit=10&offset=0&sortDir=desc&sortBy=name");
  });

  it("translates page into an offset and carries the current sort", async () => {
    const l = usePaginatedList("k", "/things", "name");
    l.page.value = 3;
    l.sortBy.value = "email";
    l.sortDir.value = "asc";
    await capturedFetcher();
    expect(call).toHaveBeenCalledWith("/things?limit=10&offset=20&sortDir=asc&sortBy=email");
  });

  it("appends the search term once it has been debounced", async () => {
    const l = usePaginatedList("k", "/things", "name");
    l.search.value = "spam";
    await nextTick();
    await capturedFetcher();
    expect(call).toHaveBeenCalledWith("/things?limit=10&offset=0&sortDir=desc&sortBy=name&search=spam");
  });

  it("resolves a function path (domain-scoped route) before fetching", async () => {
    usePaginatedList("k", () => "/domains/1/recipients", "created");
    await capturedFetcher();
    expect(call).toHaveBeenCalledWith("/domains/1/recipients?limit=10&offset=0&sortDir=desc&sortBy=created");
  });

  it("toasts and rethrows when the underlying call fails", async () => {
    usePaginatedList("k", "/things", "name");
    call.mockRejectedValueOnce(new Error("boom"));
    await expect(capturedFetcher()).rejects.toThrow("boom");
    expect(add).toHaveBeenCalledWith({ title: "common.failed", color: "error" });
  });
});
