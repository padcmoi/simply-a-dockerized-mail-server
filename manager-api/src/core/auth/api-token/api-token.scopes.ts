// A key is capped by its account and floored by its scope.
//
// The account has always been the ceiling: a key authenticates as its owner, so
// the permission guards resolve the owner's ACL and a key can never do what the
// account cannot. What was missing is the floor. A key minted for one job
// carried every right the account held, so a leaked backup key opened whatever
// its owner could open, and a root account's key was root.
//
// A scope says what the key may use out of that. The effective rights are the
// intersection: the permission guards enforce the account side, and this
// enforces the scope side. Nothing here widens anything, which is why it can
// live outside the permission guard: it only ever refuses.

export interface ScopeEntry {
  resource: string;
  actions: string[];
}

export interface DomainScopeEntry extends ScopeEntry {
  domainId: number;
}

export interface TokenScopes {
  global: ScopeEntry[];
  domain: DomainScopeEntry[];
}

// Null, absent or unreadable all mean the same thing: this key was never
// narrowed, so it keeps the account's whole reach. Unreadable is deliberately
// not a refusal - a key that stopped working because a column could not be
// parsed would be a lockout nobody can diagnose.
export function parseScopes(stored: string | null): TokenScopes | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<TokenScopes>;
    const global = Array.isArray(parsed.global) ? parsed.global : [];
    const domain = Array.isArray(parsed.domain) ? parsed.domain : [];
    if (!global.length && !domain.length) return null;
    return { global, domain };
  } catch {
    return null;
  }
}

export function serialiseScopes(scopes: TokenScopes | null | undefined): string | null {
  if (!scopes) return null;
  const global = (scopes.global ?? []).filter((e) => e.resource && e.actions?.length);
  const domain = (scopes.domain ?? []).filter((e) => e.resource && e.actions?.length && Number.isInteger(e.domainId));
  if (!global.length && !domain.length) return null;
  return JSON.stringify({ global, domain });
}

// `access` is demanded implicitly for every other action of a resource, so a
// scope naming an action without it would be a scope that grants nothing.
const withAccess = (actions: string[]) => (actions.includes("access") ? actions : ["access", ...actions]);

const covers = (held: string[] | undefined, wanted: string[]) =>
  held !== undefined && wanted.every((action) => held.includes(action));

export function scopeAllowsGlobal(scopes: TokenScopes, resource: string, actions: string[]): boolean {
  const entry = scopes.global.find((e) => e.resource === resource);
  return covers(entry && withAccess(entry.actions), withAccess(actions));
}

export function scopeAllowsDomain(scopes: TokenScopes, domainId: number, resource: string, actions: string[]): boolean {
  const entry = scopes.domain.find((e) => e.domainId === domainId && e.resource === resource);
  return covers(entry && withAccess(entry.actions), withAccess(actions));
}

// The two assertions a ceiling check needs, and nothing more. The permission
// service satisfies this with its own `assertOne`, so the caller hands it over
// unchanged; a test satisfies it with two functions instead of standing in for a
// class whose twenty other members it never touches.
export interface PermissionAssert {
  global(accountId: string, resource: string, options: { acrud: string[] }): Promise<unknown>;
  domain(accountId: string, domainId: number, resource: string, options: { acrud: string[] }): Promise<unknown>;
}

// Nothing may be put in a scope that its author does not hold, or a key would be
// a way to mint rights rather than a way to narrow them, and the whole point is
// that the account stays the ceiling.
//
// The library only offers an assertion, which throws; a boolean is what is
// wanted here, so the throw is the answer.
export async function refuseScopesBeyondAccount(
  assert: PermissionAssert,
  accountId: string,
  isRoot: boolean,
  scopes: TokenScopes
): Promise<string[]> {
  if (isRoot) return [];

  const refused: string[] = [];
  for (const entry of scopes.global) {
    try {
      await assert.global(accountId, entry.resource, { acrud: withAccess(entry.actions) });
    } catch {
      refused.push(`${entry.resource}[${entry.actions.join(", ")}]`);
    }
  }
  for (const entry of scopes.domain) {
    try {
      await assert.domain(accountId, entry.domainId, entry.resource, { acrud: withAccess(entry.actions) });
    } catch {
      refused.push(`domain #${entry.domainId} ${entry.resource}[${entry.actions.join(", ")}]`);
    }
  }
  return refused;
}
