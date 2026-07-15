import { describe, it, expect, vi, beforeEach } from "vitest";
import { provideBreadcrumb, useBreadcrumb } from "~/composables/useBreadcrumb";

// provide/inject need a component instance to round-trip through. Rather than
// render a component (the suite forbids it), back them with a plain Map keyed by
// the module's private InjectionKey symbol -- the exact context the composable
// pair shares at runtime. Only these two globals are overridden here.
let bag: Map<unknown, unknown>;
beforeEach(() => {
  bag = new Map();
  vi.stubGlobal("provide", (k: unknown, v: unknown) => bag.set(k, v));
  vi.stubGlobal("inject", (k: unknown) => bag.get(k));
});

describe("useBreadcrumb", () => {
  it("throws when used without a provider", () => {
    expect(() => useBreadcrumb()).toThrow("useBreadcrumb called outside BreadcrumbProvider");
  });

  it("provides an empty items ref that the consumer receives by identity", () => {
    const items = provideBreadcrumb();
    const ctx = useBreadcrumb();
    expect(items.value).toEqual([]);
    expect(ctx.items).toBe(items);
  });

  it("set() prepends the Home crumb ahead of the supplied trail", () => {
    const items = provideBreadcrumb();
    const ctx = useBreadcrumb();
    ctx.set([{ label: "Domains", to: "/domains" }]);
    expect(items.value).toEqual([
      { label: "layout.home", icon: "i-lucide-house", to: "/" },
      { label: "Domains", to: "/domains" },
    ]);
  });

  it("set() replaces the previous trail rather than appending to it", () => {
    const items = provideBreadcrumb();
    const ctx = useBreadcrumb();
    ctx.set([{ label: "First", to: "/a" }]);
    ctx.set([{ label: "Second", to: "/b" }]);
    expect(items.value).toEqual([
      { label: "layout.home", icon: "i-lucide-house", to: "/" },
      { label: "Second", to: "/b" },
    ]);
  });
});
