import { describe, it, expect, vi, beforeEach } from "vitest";

import { usePermissions } from "~/composables/usePermissions";

// usePermissions imports its two Pinia stores directly, so mock the modules
// (rather than the composable's store logic, which the store specs own). The
// hoisted holder lets each test set the session/data the fakes return.
// Mirrors the permissions store's (non-exported) PermissionsData shape so the
// mock's `data` is typed instead of laundered through `as unknown`.
type MockPermissionsData = {
  global: { resource: string; action: string }[];
  domain: { domainId: number; resource: string; action: string; domainName: string }[];
};

const h = vi.hoisted(() => {
  const data: MockPermissionsData = { global: [], domain: [] };
  return {
    session: null as { isRoot?: boolean } | null,
    data,
    hasGlobal: vi.fn(),
    hasDomain: vi.fn(),
  };
});

vi.mock("~/stores/auth", () => ({
  useAuthStore: () => ({
    get session() {
      return h.session;
    },
  }),
}));

vi.mock("~/stores/permissions", () => ({
  usePermissionsStore: () => ({
    get data() {
      return h.data;
    },
    hasGlobal: h.hasGlobal,
    hasDomain: h.hasDomain,
  }),
}));

beforeEach(() => {
  h.session = null;
  h.data = { global: [], domain: [] };
  h.hasGlobal.mockReset();
  h.hasDomain.mockReset();
});

describe("usePermissions.isRoot", () => {
  it("is true when the session flags root", () => {
    h.session = { isRoot: true };
    expect(usePermissions().isRoot.value).toBe(true);
  });

  it("is false when the session flags non-root", () => {
    h.session = { isRoot: false };
    expect(usePermissions().isRoot.value).toBe(false);
  });

  it("falls back to false when isRoot is absent", () => {
    h.session = {};
    expect(usePermissions().isRoot.value).toBe(false);
  });

  it("falls back to false when there is no session", () => {
    h.session = null;
    expect(usePermissions().isRoot.value).toBe(false);
  });
});

describe("usePermissions.permissions", () => {
  it("mirrors the store's permission data", () => {
    h.data = { global: [{ resource: "rspamd", action: "view-rspamd-stats" }], domain: [] };
    expect(usePermissions().permissions.value).toBe(h.data);
  });
});

describe("usePermissions delegation", () => {
  it("forwards hasGlobal to the store and returns its answer", () => {
    h.hasGlobal.mockReturnValue(true);
    const { hasGlobal } = usePermissions();
    expect(hasGlobal("rspamd", "view-rspamd-stats")).toBe(true);
    expect(h.hasGlobal).toHaveBeenCalledWith("rspamd", "view-rspamd-stats");
  });

  it("forwards hasDomain to the store and returns its answer", () => {
    h.hasDomain.mockReturnValue(false);
    const { hasDomain } = usePermissions();
    expect(hasDomain(5, "recipients", "create")).toBe(false);
    expect(h.hasDomain).toHaveBeenCalledWith(5, "recipients", "create");
  });
});
