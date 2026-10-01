import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

import { useDomainLookup } from "~/composables/useDomainLookup";

const h = vi.hoisted(() => ({
  selected: null as { id: number; domain: string } | null,
  domainRows: [] as { domainId: number; domainName: string; resource: string; action: string }[],
}));

vi.mock("~/stores/domain", () => ({
  useDomainStore: () => ({
    get selected() {
      return h.selected;
    },
  }),
}));

vi.mock("~/stores/permissions", () => ({
  usePermissionsStore: () => ({
    get data() {
      return { global: [], domain: h.domainRows };
    },
  }),
}));

let call: ReturnType<typeof vi.fn>;

function stubRights(isRoot: boolean, domainsAccess: boolean) {
  vi.stubGlobal("usePermissions", () => ({
    isRoot: ref(isRoot),
    hasGlobal: (resource: string, action: string) => domainsAccess && resource === "domains" && action === "access",
  }));
}

beforeEach(() => {
  h.selected = null;
  h.domainRows = [];
  call = vi.fn();
  vi.stubGlobal("useApi", () => ({ call }));
});

describe("useDomainLookup.findDomain", () => {
  it("looks the domain up in the list when the caller may read it", async () => {
    stubRights(false, true);
    call.mockResolvedValue([
      { id: 1, domain: "a.test" },
      { id: 2, domain: "b.test" },
    ]);
    expect(await useDomainLookup().findDomain("b.test")).toEqual({ id: 2, domain: "b.test" });
    expect(call).toHaveBeenCalledWith("/domains");
  });

  it("does the same for root", async () => {
    stubRights(true, false);
    call.mockResolvedValue([{ id: 1, domain: "a.test" }]);
    expect(await useDomainLookup().findDomain("zzz.test")).toBeNull();
    expect(call).toHaveBeenCalledWith("/domains");
  });

  it("resolves an owned domain from the caller's domain permissions, never asking for the list", async () => {
    stubRights(false, false);
    h.domainRows = [{ domainId: 7, domainName: "mine.test", resource: "domain", action: "access" }];
    call.mockResolvedValue({ id: 7, domain: "mine.test", quota: "10" });
    expect(await useDomainLookup().findDomain("mine.test")).toEqual({ id: 7, domain: "mine.test", quota: "10" });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith("/domains/7");
  });

  it("falls back to the domain selected in the store", async () => {
    stubRights(false, false);
    h.selected = { id: 9, domain: "picked.test" };
    call.mockResolvedValue({ id: 9, domain: "picked.test" });
    expect(await useDomainLookup().findDomain("picked.test")).toEqual({ id: 9, domain: "picked.test" });
    expect(call).toHaveBeenCalledWith("/domains/9");
  });

  it("answers null without any call for a domain the caller has no right on", async () => {
    stubRights(false, false);
    h.selected = { id: 9, domain: "other.test" };
    expect(await useDomainLookup().findDomain("foreign.test")).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it("answers null when the API refuses the domain or returns another one", async () => {
    stubRights(false, false);
    h.domainRows = [{ domainId: 7, domainName: "mine.test", resource: "domain", action: "access" }];
    call.mockRejectedValueOnce(new Error("403"));
    expect(await useDomainLookup().findDomain("mine.test")).toBeNull();
    call.mockResolvedValueOnce({ id: 7, domain: "renamed.test" });
    expect(await useDomainLookup().findDomain("mine.test")).toBeNull();
  });
});
