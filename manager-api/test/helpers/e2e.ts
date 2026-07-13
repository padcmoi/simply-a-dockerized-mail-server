import { ForbiddenException, INestApplication, Type, VersioningType } from "@nestjs/common";
import { vi } from "vitest";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test, type ModuleMetadata } from "@nestjs/testing";
import { CombinedAuthGuard } from "../../src/core/auth/auth.guard";
import { ApiTokenService } from "../../src/core/auth/api-token/api-token.service";
import { GlobalPermissionGuard } from "../../src/core/custom-permission-guard/global-permission.guard";
import { DomainPermissionGuard } from "../../src/core/custom-permission-guard/domain-permission.guard";
import { CustomPermissionGuardService } from "../../src/core/custom-permission-guard/custom-permission-guard.service";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";

const SECRET = process.env.MANAGER_JWT_ACCESS_SECRET ?? "test-access-secret";

export interface TestUser {
  id: string;
  email: string;
  isRoot?: boolean;
}

// A controllable stand-in for the real permission library. assertOne.global /
// assertOne.domain resolve only when the exact (resource, action) pair was
// granted, and throw ForbiddenException otherwise -- exactly the shape the two
// permission guards expect, so their real code paths (root bypass, ownership,
// domains-access prerequisite, bridge) run unchanged against it.
export function makeCpgMock() {
  const global = new Set<string>();
  const domain = new Set<string>();
  const guard = {
    assertOne: {
      global: vi.fn(async (_uid: string, resource: string, opts: { acrud: string[] }) => {
        for (const a of opts.acrud) if (!global.has(`${resource}:${a}`)) throw new ForbiddenException(`Missing ${resource}:${a}`);
      }),
      domain: vi.fn(async (_uid: string, domainId: number, resource: string, opts: { acrud: string[] }) => {
        for (const a of opts.acrud)
          if (!domain.has(`${domainId}:${resource}:${a}`)) throw new ForbiddenException(`Missing ${domainId}:${resource}:${a}`);
      }),
    },
  };
  return {
    guard,
    grantGlobal(resource: string, ...actions: string[]) {
      for (const a of actions) global.add(`${resource}:${a}`);
    },
    grantDomain(domainId: number, resource: string, ...actions: string[]) {
      for (const a of actions) domain.add(`${domainId}:${resource}:${a}`);
    },
    reset() {
      global.clear();
      domain.clear();
    },
  };
}

export type CpgMock = ReturnType<typeof makeCpgMock>;

export interface Harness {
  app: INestApplication;
  cpg: CpgMock;
  // Marks a domain as owned by an account, so DomainPermissionGuard's ownership
  // bypass can be exercised (and, by default, ownership never accidentally grants).
  setDomainOwner(domainId: number, ownerId: string | null): void;
  // Signs a JWT the CombinedAuthGuard accepts; attach as `Bearer <token>`.
  token(user: TestUser): string;
  close(): Promise<void>;
}

// Boots a real HTTP app for one (or more) controllers with the REAL auth +
// permission guards wired, and everything below the guards mocked: the caller
// passes the controller's own service/repository mocks in `providers`, and gets
// back handles to mint tokens and grant permissions. No database, no network.
export async function buildHarness(opts: {
  controllers: Type[];
  providers?: ModuleMetadata["providers"];
}): Promise<Harness> {
  const cpg = makeCpgMock();
  const owners = new Map<number, string | null>();
  // Default VirtualDomain repo double. Serves the DomainPermissionGuard's
  // ownership check AND any controller that injects the repo directly (hence the
  // `domain` field, so resolveFqdn-style code has a string to work with). A spec
  // that needs richer behaviour overrides the token via `providers` (they win,
  // being registered last).
  const domainRepo = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) => {
      const ownerId = owners.get(where.id) ?? null;
      return { id: where.id, domain: `d${where.id}.test`, ownerId } as VirtualDomain;
    }),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: SECRET })],
    controllers: opts.controllers,
    providers: [
      GlobalPermissionGuard,
      DomainPermissionGuard,
      { provide: APP_GUARD, useClass: CombinedAuthGuard },
      { provide: CustomPermissionGuardService, useValue: cpg },
      { provide: getRepositoryToken(VirtualDomain), useValue: domainRepo },
      { provide: ApiTokenService, useValue: { validate: vi.fn().mockResolvedValue(null) } },
      ...(opts.providers ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  await app.init();

  const jwt = app.get(JwtService);
  return {
    app,
    cpg,
    setDomainOwner: (domainId, ownerId) => owners.set(domainId, ownerId),
    token: (user) => jwt.sign({ sub: user.id, email: user.email, isRoot: user.isRoot === true }, { secret: SECRET }),
    close: () => app.close(),
  };
}

export const ROOT: TestUser = { id: "root-id", email: "root@test.local", isRoot: true };
export const USER: TestUser = { id: "user-id", email: "user@test.local", isRoot: false };
