import { vi, type Mock } from "vitest";
import type { ObjectLiteral, Repository, SelectQueryBuilder } from "typeorm";
import type { CustomPermissionGuardService } from "../../src/core/custom-permission-guard/custom-permission-guard.service";

// Typed test doubles for unit specs. The point is that a service constructor and
// its method calls stay type-checked: a double is typed as the real dependency,
// so passing the wrong repository or calling a service method with a DTO that
// does not match the business type now fails `tsc`, instead of being silenced by
// the `as never` these helpers replace. The single structural cast is contained
// in each helper, never at a spec call site.

// The real dependency with every method swapped for a vitest Mock: it stays
// assignable to the dependency's type (so it drops into a constructor with no
// cast) while each method exposes `.mockResolvedValue(...)` and friends. Return
// values stay loose on purpose -- a repository/query-builder double should not
// force a full entity literal at every stub; the service API around it is what
// these specs pin down.
type LooseMethods<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown ? Mock : T[K];
};

// The dependency's own type intersected with the mocked-method view. The `& T`
// keeps it assignable to a constructor parameter even when T is a class with
// private members (a plain object never is); the LooseMethods side exposes
// `.mockResolvedValue(...)` and accepts any resolved value.
export type Loose<T> = LooseMethods<T> & T;

const REPO_METHODS = [
  "find",
  "findBy",
  "findOne",
  "findOneBy",
  "findAndCount",
  "count",
  "exists",
  "existsBy",
  "create",
  "merge",
  "preload",
  "save",
  "insert",
  "update",
  "upsert",
  "delete",
  "remove",
  "softDelete",
  "increment",
  "decrement",
  "query",
  "createQueryBuilder",
] as const;

// A TypeORM repository double: the methods a service calls, each a vi.fn().
export function repoMock<T extends ObjectLiteral>(): Loose<Repository<T>> {
  const repo: Record<string, Mock> = {};
  for (const name of REPO_METHODS) repo[name] = vi.fn();
  // `create` echoes a shallow COPY of its input by default: the service often
  // mutates the created entity afterwards, and a copy keeps the object vitest
  // recorded for the `create` call from being rewritten by those later mutations.
  repo.create.mockImplementation((x: unknown) => (Array.isArray(x) ? [...x] : { ...(x as object) }));
  return repo as unknown as Loose<Repository<T>>;
}

const QB_CHAIN = [
  "select",
  "addSelect",
  "from",
  "leftJoin",
  "leftJoinAndSelect",
  "innerJoin",
  "innerJoinAndSelect",
  "where",
  "andWhere",
  "orWhere",
  "orderBy",
  "addOrderBy",
  "groupBy",
  "having",
  "skip",
  "take",
  "limit",
  "offset",
  "setParameter",
  "setParameters",
  "update",
  "set",
  "delete",
] as const;

const QB_TERMINAL = ["getMany", "getManyAndCount", "getRawMany", "getRawOne", "getOne", "getCount", "execute"] as const;

// A chainable SelectQueryBuilder double: chain methods return the builder; the
// terminal methods are stubbed per test.
export function qbMock<T extends ObjectLiteral>(): Loose<SelectQueryBuilder<T>> {
  const qb: Record<string, Mock> = {};
  for (const name of QB_CHAIN) qb[name] = vi.fn(() => qb);
  for (const name of QB_TERMINAL) qb[name] = vi.fn();
  return qb as unknown as Loose<SelectQueryBuilder<T>>;
}

// A structural double for a service/provider dependency: pass only the methods
// the code under test uses. Each is checked to be a real method name of T (a
// typo fails `tsc`), the result slots into a constructor with no call-site cast,
// and every method still exposes the vitest Mock surface for assertions.
export function providerMock<T>(methods: Partial<Loose<T>>): Loose<T> {
  return methods as Loose<T>;
}

// A typed partial entity/DTO for a mock return value: `entity<Account>({ id, isRoot })`
// checks the given fields against the real type (a wrong field name or value type
// fails `tsc`) while allowing the rest to be omitted, so specs never fall back to
// `as never` to hand a repository double its rows.
export function entity<T>(partial: Partial<T>): T {
  return partial as T;
}

// The `.guard` object CustomPermissionGuardService exposes is the third-party
// @naskot/custom-permission-guard surface: a large, nested API. This is the one
// mocked shape a plain vi.fn() map cannot express structurally, so its single
// contained cast lives here. Specs get a real CustomPermissionGuardService (it
// drops into a constructor) whose guard methods are Mocks ready to stub/assert.
type GuardMock = {
  assertOne: { global: Mock; domain: Mock };
  assertAll: { global: Mock; domain: Mock };
  assignAccountToGroup: Mock;
  removeAccountFromGroup: Mock;
  createGroup: Mock;
  updateGroup: Mock;
  deleteGroup: Mock;
  setDefaultGroup: Mock;
  setGroupOwner: Mock;
  setGroupProtected: Mock;
  setGroupGlobalPermissions: Mock;
  setGroupDomainPermissions: Mock;
  getEffectivePermissions: Mock;
  findGroupGlobalPermissions: Mock;
  findGroupDomainPermissions: Mock;
  canActivate: Mock;
  service: Record<string, Mock>;
  utils: { check: { global: Mock; domain: Mock }; diffPermissions: Mock; findUnheldPermissions: Mock };
};

export type CpgMock = CustomPermissionGuardService & { guard: GuardMock };

export function cpgMock(): CpgMock {
  const guard: GuardMock = {
    assertOne: { global: vi.fn(), domain: vi.fn() },
    assertAll: { global: vi.fn(), domain: vi.fn() },
    assignAccountToGroup: vi.fn(),
    removeAccountFromGroup: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    setDefaultGroup: vi.fn(),
    setGroupOwner: vi.fn(),
    setGroupProtected: vi.fn(),
    setGroupGlobalPermissions: vi.fn(),
    setGroupDomainPermissions: vi.fn(),
    getEffectivePermissions: vi.fn(),
    findGroupGlobalPermissions: vi.fn(),
    findGroupDomainPermissions: vi.fn(),
    canActivate: vi.fn(),
    service: {},
    utils: { check: { global: vi.fn(), domain: vi.fn() }, diffPermissions: vi.fn(), findUnheldPermissions: vi.fn() },
  };
  return { guard } as unknown as CpgMock;
}
