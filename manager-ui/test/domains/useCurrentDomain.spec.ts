import { describe, it, expect, vi, beforeEach } from "vitest";

import { useCurrentDomain } from "~/composables/useCurrentDomain";

// useCurrentDomain imports the domain store directly, so mock that module; the
// route and API are Nuxt auto-imports stubbed per test. We assert the pure
// derivations (domainFqdn coercion, the domainId guard), not the fetch.
const h = vi.hoisted(() => ({
  selected: null as { id?: number; domain: string } | null,
}));

vi.mock("~/stores/domain", () => ({
  useDomainStore: () => ({
    get selected() {
      return h.selected;
    },
    select: vi.fn(),
    clear: vi.fn(),
  }),
}));

function stubRoute(domain: unknown) {
  vi.stubGlobal("useRoute", () => ({ path: "/", params: { domain }, query: {}, fullPath: "/" }));
}

beforeEach(() => {
  h.selected = null;
  vi.stubGlobal("useApi", () => ({ call: vi.fn() }));
});

describe("useCurrentDomain.domainFqdn", () => {
  it("reads the :domain slug as a string", () => {
    stubRoute("example.com");
    expect(useCurrentDomain().domainFqdn.value).toBe("example.com");
  });

  it("coerces a missing slug through String()", () => {
    stubRoute(undefined);
    expect(useCurrentDomain().domainFqdn.value).toBe("undefined");
  });
});

describe("useCurrentDomain.domainId", () => {
  it("returns the store id when the selected domain matches the slug", () => {
    stubRoute("example.com");
    h.selected = { id: 42, domain: "example.com" };
    expect(useCurrentDomain().domainId.value).toBe(42);
  });

  it("is null when a stale, different domain is still selected", () => {
    stubRoute("example.com");
    h.selected = { id: 42, domain: "other.com" };
    expect(useCurrentDomain().domainId.value).toBeNull();
  });

  it("is null when no domain is selected yet", () => {
    stubRoute("example.com");
    h.selected = null;
    expect(useCurrentDomain().domainId.value).toBeNull();
  });

  it("is null when the matched domain carries no id", () => {
    stubRoute("example.com");
    h.selected = { domain: "example.com" };
    expect(useCurrentDomain().domainId.value).toBeNull();
  });
});
