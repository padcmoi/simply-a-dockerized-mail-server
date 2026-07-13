# manager-api test suite

No database, no containers, no network. Runs with `pnpm test` (vitest, compiled by
unplugin-swc so NestJS decorator metadata / DI resolve as at runtime). Every spec
imports what it uses from `vitest` (`describe`, `it`, `expect`, `vi`, hooks).

## Layout

- `test/acl-cartography.spec.ts` + `test/__snapshots__/` — the security contract:
  reflects every route's auth strategy, guards and required permissions off the
  controller metadata and locks it. **Do not weaken.** When a route legitimately
  changes, run `pnpm test -u` and review the snapshot + allowlists diff.
- `test/helpers/` — shared machinery. Do not edit when adding coverage:
  - `route-scanner.ts` — reflects routes off controllers.
  - `controllers.ts` — the list of every controller (add new ones here).
  - `e2e.ts` — `buildHarness(...)`, the real-guards HTTP harness.
- `test/api/*.e2e-spec.ts` — one per controller: auth (401), ACL (403 vs 200),
  behavior + validation (through the mocked service).
- `test/unit/*.spec.ts` — one per service/guard/util: pure logic against mocked
  repositories, no HTTP.

## e2e pattern (controllers)

`buildHarness` wires the REAL `CombinedAuthGuard` (global auth), `GlobalPermissionGuard`
and `DomainPermissionGuard`; everything below is mocked. You pass the controller's
own service mocks in `providers`.

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

let h: Harness;
const svc = { list: vi.fn() /* ...one fn per service method... */ };
beforeAll(async () => {
  h = await buildHarness({ controllers: [FooController], providers: [{ provide: FooService, useValue: svc }] });
});
afterAll(() => h.close());
beforeEach(() => h.cpg.reset());
const api = () => request(h.app.getHttpServer());
```

Every route MUST assert, at minimum:
- **401** with no token and with a garbage `Bearer` token.
- **403** for `USER` (non-root) with no grant.
- **2xx** for `ROOT` (root bypass), asserting the service was called correctly.
- **2xx** for `USER` after granting the exact permission (see below).
- **400** on invalid body/params where a Zod pipe or `ParseIntPipe` applies.

Granting permissions to a non-root user:
- Global route: `h.cpg.grantGlobal("sieve", "access", "list-reject-senders")`.
- Domain route (`:domainId`): a non-root needs the whole chain — for a resource
  other than `domain`: `h.cpg.grantGlobal("domains", "access")`,
  `h.cpg.grantDomain(ID, "domain", "access")`, then
  `h.cpg.grantDomain(ID, "recipients", "access", "list-recipients")`. Simpler:
  use `ROOT` for the happy-path/behavior assertions and rely on a single non-root
  403 for the ACL check, plus one non-root 200 via the full grant on at least one
  domain route per controller.
- Ownership bypass: `h.setDomainOwner(ID, USER.id)` then call as `USER` → passes
  without any grant.

Token: `.set("Authorization", ` + "`Bearer ${h.token(USER)}`" + `)`.

## unit pattern (services)

Instantiate the service directly with a mock repo (only the methods it calls):

```ts
const repo = { findOne: vi.fn(), save: vi.fn((x) => Promise.resolve(x)) /* ... */ };
const svc = new FooService(repo as never);
```

Cover: every branch (not-found → `NotFoundException`, conflict → `ConflictException`,
success), pagination/sort fallbacks, and any external call (rspamd/redis `fetch`,
`child_process`) mocked via `vi.spyOn`/`vi.mock`. For services with several
repos/deps, pass one mock per constructor arg in order.

## Rules

- Only add files under `test/api/` and `test/unit/`, plus new controller imports
  in `test/helpers/controllers.ts`.
- Never touch `vitest.config.ts`, `test/setup.ts`, `test/helpers/e2e.ts`,
  `test/helpers/route-scanner.ts`, or the cartography snapshot logic.
- Run your own files with `npx vitest run <path>` until green before finishing.
