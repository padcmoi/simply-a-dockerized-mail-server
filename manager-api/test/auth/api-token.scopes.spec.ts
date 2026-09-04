import { describe, it, expect, vi } from "vitest";
import {
  parseScopes,
  refuseScopesBeyondAccount,
  scopeAllowsDomain,
  scopeAllowsGlobal,
  serialiseScopes,
  type PermissionAssert,
  type TokenScopes,
} from "../../src/core/auth/api-token/api-token.scopes";

// A key is capped by its account and floored by its scope. The account side has
// always held: a key authenticates as its owner, so the permission guards
// resolve the owner's rights and a key can never do what the account cannot.
// What is pinned here is the floor, and above all that it only ever refuses.

const scopes = (global: TokenScopes["global"] = [], domain: TokenScopes["domain"] = []): TokenScopes => ({ global, domain });

// The library only offers an assertion, which throws on a right the account does
// not hold. This double is that behaviour and nothing else: the resources it was
// given pass, everything else throws.
function grants(held: string[]) {
  const answer = (resource: string) => {
    if (!held.includes(resource)) throw new Error("forbidden");
    return Promise.resolve();
  };
  const assert: PermissionAssert = {
    global: vi.fn((_id: string, resource: string) => answer(resource)),
    domain: vi.fn((_id: string, _domainId: number, resource: string) => answer(resource)),
  };
  return assert;
}

describe("api token scopes", () => {
  describe("what a scope means", () => {
    // Null, absent and unreadable all mean the same thing: this key was never
    // narrowed. A key that stopped working because a column could not be parsed
    // would be a lockout nobody can diagnose.
    it("reads an absent, empty or unreadable scope as no narrowing at all", () => {
      expect(parseScopes(null)).toBeNull();
      expect(parseScopes("")).toBeNull();
      expect(parseScopes("{oops")).toBeNull();
      expect(parseScopes(JSON.stringify({ global: [], domain: [] }))).toBeNull();
    });

    it("keeps what was declared, and writes back nothing when nothing was", () => {
      const stored = serialiseScopes(scopes([{ resource: "domains", actions: ["access"] }]));
      expect(parseScopes(stored)).toEqual({ global: [{ resource: "domains", actions: ["access"] }], domain: [] });
      expect(serialiseScopes(null)).toBeNull();
      expect(serialiseScopes(scopes())).toBeNull();
    });

    it("drops an entry that names a resource without naming an action", () => {
      expect(serialiseScopes(scopes([{ resource: "domains", actions: [] }]))).toBeNull();
    });
  });

  describe("what a scope allows", () => {
    it("allows exactly what it names, and nothing beside it", () => {
      const held = scopes([{ resource: "domains", actions: ["access", "list-domains"] }]);
      expect(scopeAllowsGlobal(held, "domains", ["list-domains"])).toBe(true);
      expect(scopeAllowsGlobal(held, "domains", ["delete-domain"])).toBe(false);
      expect(scopeAllowsGlobal(held, "accounts", ["access"])).toBe(false);
    });

    // `access` is demanded implicitly for every other action of a resource, so a
    // scope naming an action without it would be a scope that grants nothing.
    it("reads access into a scope that only named the action it is for", () => {
      const held = scopes([{ resource: "domains", actions: ["list-domains"] }]);
      expect(scopeAllowsGlobal(held, "domains", ["list-domains"])).toBe(true);
      expect(scopeAllowsGlobal(held, "domains", ["access"])).toBe(true);
    });

    it("binds a domain scope to its domain and to no other", () => {
      const held = scopes([], [{ domainId: 4, resource: "recipients", actions: ["access", "list-recipients"] }]);
      expect(scopeAllowsDomain(held, 4, "recipients", ["list-recipients"])).toBe(true);
      expect(scopeAllowsDomain(held, 5, "recipients", ["list-recipients"])).toBe(false);
      expect(scopeAllowsDomain(held, 4, "aliases", ["access"])).toBe(false);
    });
  });

  describe("the ceiling", () => {
    // A key would be a way to mint rights rather than to narrow them if this let
    // anything through that its author does not hold.
    it("refuses a scope naming what the account does not hold, and names what it refused", async () => {
      const assert = grants(["domains"]);
      const refused = await refuseScopesBeyondAccount(
        assert,
        "acc-1",
        false,
        scopes([
          { resource: "domains", actions: ["access"] },
          { resource: "accounts", actions: ["access", "delete-account"] },
        ])
      );
      expect(refused).toEqual(["accounts[access, delete-account]"]);
    });

    it("refuses a domain scope the account does not hold on that domain", async () => {
      const assert = grants([]);
      const refused = await refuseScopesBeyondAccount(
        assert,
        "acc-1",
        false,
        scopes([], [{ domainId: 9, resource: "recipients", actions: ["access"] }])
      );
      expect(refused).toEqual(["domain #9 recipients[access]"]);
    });

    it("lets a root account scope a key to anything, root holding everything", async () => {
      const assert = grants([]);
      const refused = await refuseScopesBeyondAccount(
        assert,
        "acc-1",
        true,
        scopes([{ resource: "accounts", actions: ["access"] }])
      );
      expect(refused).toEqual([]);
      expect(assert.global).not.toHaveBeenCalled();
    });
  });
});
