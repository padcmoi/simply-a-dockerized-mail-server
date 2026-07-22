import { execSync } from "child_process";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { APP_GUARD } from "@nestjs/core";
import { scanAll, contractLine } from "../helpers/route-scanner";
import { ALL_CONTROLLERS } from "../helpers/controllers";
import { AppModule } from "../../src/app.module";
import { CombinedAuthGuard } from "../../src/core/auth/auth.guard";
import { GlobalPermissionGuard } from "../../src/core/custom-permission-guard/global-permission.guard";
import { DomainPermissionGuard } from "../../src/core/custom-permission-guard/domain-permission.guard";
import { GLOBAL_ACTIONS, DOMAIN_ACTIONS } from "../../src/core/custom-permission-guard/permission-catalog";

const routes = scanAll(ALL_CONTROLLERS);

// The ONLY routes reachable with no authentication at all. Anything else must
// require auth. A new public route forces a conscious edit of this list, which
// is the whole point: a silently public route is exactly the vulnerability this
// suite exists to catch.
const EXPECTED_PUBLIC = [
  "GET /api/v1/accounts/invite/:token",
  "GET /api/v1/health",
  "POST /api/v1/accounts/invite/:token/accept",
  "POST /api/v1/auth/jwt/login",
  "POST /api/v1/auth/jwt/logout",
  "POST /api/v1/auth/jwt/refresh",
].sort();

// Authenticated but intentionally carrying NO ACL requirement: the self-scoped
// "my own ..." routes, and the two bulk-membership routes whose root-only rule
// is enforced inside GroupsService (empty @RequireGlobalPermissions on purpose).
// Every other authenticated route MUST declare a permission requirement.
const EXPECTED_NO_ACL_AUTHED = [
  "DELETE /api/v1/auth/jwt/me/sessions/:id",
  "DELETE /api/v1/groups/:id/members/all",
  "DELETE /api/v1/notifications/:id",
  "GET /api/v1/auth/jwt/me",
  "GET /api/v1/auth/jwt/me/groups/:id/permissions",
  "GET /api/v1/auth/jwt/me/overview",
  "GET /api/v1/auth/jwt/me/permissions",
  "GET /api/v1/auth/jwt/me/sessions",
  "GET /api/v1/auth/jwt/me/sessions/history",
  "GET /api/v1/notifications",
  "GET /api/v1/notifications/feed",
  "GET /api/v1/notifications/preferences",
  "PATCH /api/v1/auth/jwt/me",
  "POST /api/v1/groups/:id/members/all",
  "POST /api/v1/notifications/:id/read",
  "POST /api/v1/notifications/read-all",
  "PUT /api/v1/notifications/preferences",
].sort();

describe("auth/ACL cartography (security contract)", () => {
  it("registers the global authentication guard app-wide", () => {
    const providers = (Reflect.getMetadata("providers", AppModule) as { provide?: unknown; useClass?: unknown }[]) ?? [];
    const appGuard = providers.find((p) => p && p.provide === APP_GUARD);
    expect(appGuard).toBeDefined();
    expect(appGuard?.useClass).toBe(CombinedAuthGuard);
  });

  it("locks the full auth/ACL cartography of every route", () => {
    // Snapshot of every route's auth strategy, guards and required permissions.
    // Any drift (a dropped guard, a changed action, a new route) fails here and
    // must be reviewed, not rubber-stamped.
    expect(routes.map(contractLine)).toMatchSnapshot();
  });

  it("exposes exactly the allowlisted public routes", () => {
    const publicPaths = routes.filter((r) => r.public).map((r) => r.path).sort();
    expect(publicPaths).toEqual(EXPECTED_PUBLIC);
  });

  it("has every authenticated route enforce an ACL unless explicitly exempt", () => {
    const unguarded = routes
      .filter((r) => !r.public && r.global.length === 0 && r.domain.length === 0 && r.serviceEnforced.length === 0)
      .map((r) => r.path)
      .sort();
    expect(unguarded).toEqual(EXPECTED_NO_ACL_AUTHED);
  });

  it("guards every domain-tier route with both permission guards and a :domainId param", () => {
    for (const r of routes.filter((r) => r.domain.length > 0)) {
      expect(r.guards).toContain(GlobalPermissionGuard.name);
      expect(r.guards).toContain(DomainPermissionGuard.name);
      expect(r.hasDomainIdParam).toBe(true);
    }
  });

  it("declares only permissions that exist in the catalog", () => {
    const checkGlobal = (resource: string, actions: readonly string[]) => {
      const known = (GLOBAL_ACTIONS as Record<string, readonly string[]>)[resource];
      expect(known).toBeDefined();
      for (const a of actions) expect(known).toContain(a);
    };
    const checkDomain = (resource: string, actions: readonly string[]) => {
      const known = (DOMAIN_ACTIONS as Record<string, readonly string[]>)[resource];
      expect(known).toBeDefined();
      for (const a of actions) expect(known).toContain(a);
    };
    for (const r of routes) {
      for (const e of r.global) checkGlobal(e.resource, e.actions);
      for (const e of r.serviceEnforced) checkGlobal(e.resource, e.actions);
      for (const e of r.domain) checkDomain(e.resource, e.actions);
    }
  });

  it("has every source controller registered in the cartography", () => {
    // A controller not in ALL_CONTROLLERS would be invisible to this whole
    // suite, so cross-check the count against the source tree.
    const out = execSync("grep -rl '@Controller(' src --include='*.ts'", {
      cwd: join(__dirname, "..", ".."),
      encoding: "utf8",
    });
    const sourceCount = out.trim().split("\n").filter(Boolean).length;
    expect(ALL_CONTROLLERS.length).toBe(sourceCount);
  });
});
