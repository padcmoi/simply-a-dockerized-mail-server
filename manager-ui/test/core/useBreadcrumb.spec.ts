import { describe, it, expect, vi, beforeEach } from "vitest";
import { provideBreadcrumb, useBreadcrumb } from "~/composables/useBreadcrumb";

// provide/inject need a component instance to round-trip through. Rather than
// render a component (the suite forbids it), back them with a plain Map keyed by
// the module's private InjectionKey symbol -- the exact context the composable
// pair shares at runtime. Only these two globals are overridden here.
let bag: Map<unknown, unknown>;
// The provider also names the browser tab from the trail, through useHead:
// capture what it registers so the title is assertable.
let head: { title: { value: string } } | null;
beforeEach(() => {
  bag = new Map();
  head = null;
  vi.stubGlobal("provide", (k: unknown, v: unknown) => bag.set(k, v));
  vi.stubGlobal("inject", (k: unknown) => bag.get(k));
  vi.stubGlobal("useHead", (input: { title: { value: string } }) => {
    head = input;
  });
});

describe("useBreadcrumb", () => {
  it("throws when used without a provider", () => {
    expect(() => useBreadcrumb()).toThrow("useBreadcrumb called outside a layout that provides it");
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
      { label: "layout.home", to: "/" },
      { label: "Domains", to: "/domains" },
    ]);
  });

  it("set() replaces the previous trail rather than appending to it", () => {
    const items = provideBreadcrumb();
    const ctx = useBreadcrumb();
    ctx.set([{ label: "First", to: "/a" }]);
    ctx.set([{ label: "Second", to: "/b" }]);
    expect(items.value).toEqual([
      { label: "layout.home", to: "/" },
      { label: "Second", to: "/b" },
    ]);
  });
});

describe("the page title the breadcrumb names", () => {
  it("is the app name alone until a page has placed itself", () => {
    provideBreadcrumb();
    expect(head?.title.value).toBe("app.name");
  });

  it("joins the trail with the app name, Home excluded", () => {
    provideBreadcrumb();
    const ctx = useBreadcrumb();
    ctx.set([{ label: "Configuration", to: "/admin/config" }, { label: "Connexion externe" }]);
    expect(head?.title.value).toBe("app.name :: Configuration > Connexion externe");
  });

  it("follows the trail as the page changes it", () => {
    provideBreadcrumb();
    const ctx = useBreadcrumb();
    ctx.set([{ label: "Domaines", to: "/admin/domains" }]);
    expect(head?.title.value).toBe("app.name :: Domaines");
    ctx.set([]);
    expect(head?.title.value).toBe("app.name");
  });
});
