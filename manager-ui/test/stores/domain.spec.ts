import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineStore, setActivePinia, createPinia } from "pinia";

// app/stores/domain.ts calls `defineStore(...)` at module-eval time via a bare
// Nuxt auto-import (no static import), so the global must be in place BEFORE the
// module is loaded. Hence: stub first, then dynamic-import the store.
vi.stubGlobal("defineStore", defineStore);
const { useDomainStore } = await import("~/stores/domain");

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("domain store", () => {
  it("starts with no selected domain", () => {
    const store = useDomainStore();
    expect(store.selected).toBeNull();
  });

  it("select sets the active domain", () => {
    const store = useDomainStore();
    const d = { id: 3, domain: "example.com", quota: "1G", active: 1 };
    store.select(d);
    expect(store.selected).toEqual(d);
  });

  it("clear resets the selection back to null", () => {
    const store = useDomainStore();
    store.select({ id: 1, domain: "a.io", quota: "0", active: 1 });
    expect(store.selected).not.toBeNull();
    store.clear();
    expect(store.selected).toBeNull();
  });

  it("select replaces a previously selected domain", () => {
    const store = useDomainStore();
    store.select({ id: 1, domain: "a.io", quota: "0", active: 1 });
    store.select({ id: 2, domain: "b.io", quota: "5G", active: 0 });
    expect(store.selected?.id).toBe(2);
    expect(store.selected?.domain).toBe("b.io");
  });
});
