import { PATH_METADATA, METHOD_METADATA, VERSION_METADATA, GUARDS_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { AUTH_PUBLIC_KEY, AUTH_STRATEGIES_KEY, type AuthStrategy } from "../../src/core/auth/auth.decorator";
import {
  REQUIRE_GLOBAL_PERMISSIONS_KEY,
  REQUIRE_DOMAIN_PERMISSIONS_KEY,
  SERVICE_ENFORCED_GLOBAL_PERMISSIONS_KEY,
  type GlobalPermissionRequirement,
  type DomainPermissionRequirement,
} from "../../src/core/custom-permission-guard/require-permissions.decorator";

export interface ScannedRoute {
  controller: string;
  handler: string;
  method: string;
  // Full external path, e.g. "GET /api/v1/domains/:domainId/recipients".
  path: string;
  public: boolean;
  strategies: AuthStrategy[] | undefined;
  guards: string[];
  global: GlobalPermissionRequirement[];
  domain: DomainPermissionRequirement[];
  serviceEnforced: GlobalPermissionRequirement[];
  hasDomainIdParam: boolean;
}

const METHOD_NAME: Record<number, string> = {
  [RequestMethod.GET]: "GET",
  [RequestMethod.POST]: "POST",
  [RequestMethod.PUT]: "PUT",
  [RequestMethod.DELETE]: "DELETE",
  [RequestMethod.PATCH]: "PATCH",
  [RequestMethod.OPTIONS]: "OPTIONS",
  [RequestMethod.HEAD]: "HEAD",
  [RequestMethod.ALL]: "ALL",
};

function guardNames(target: unknown): string[] {
  const guards = (Reflect.getMetadata(GUARDS_METADATA, target as object) as unknown[]) ?? [];
  return guards.map((g) => (typeof g === "function" ? g.name : (g as object)?.constructor?.name)).filter(Boolean);
}

// Method-level metadata wins over class-level, mirroring Reflector.getAllAndOverride.
function override<T>(handler: object, ctrl: object, key: string): T | undefined {
  const h = Reflect.getMetadata(key, handler) as T | undefined;
  return h !== undefined ? h : (Reflect.getMetadata(key, ctrl) as T | undefined);
}

function joinPath(...parts: (string | undefined)[]): string {
  const segs = parts
    .filter((p): p is string => p !== undefined && p !== "" && p !== "/")
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  return "/" + segs.join("/");
}

// Reflects one controller's routes straight off the class + prototype metadata
// NestJS writes at decoration time. No app boot, no DB, no provider instances.
export function scanController(ctrl: new (...args: never[]) => unknown): ScannedRoute[] {
  const classPath = Reflect.getMetadata(PATH_METADATA, ctrl) as string | undefined;
  const rawVersion = Reflect.getMetadata(VERSION_METADATA, ctrl) as string | string[] | undefined;
  const version = Array.isArray(rawVersion) ? rawVersion[0] : rawVersion;
  const classGuards = guardNames(ctrl);
  const proto = ctrl.prototype as Record<string, unknown>;

  const routes: ScannedRoute[] = [];
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === "constructor") continue;
    const handler = proto[name];
    if (typeof handler !== "function") continue;
    const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
    if (httpMethod === undefined) continue;

    const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
    const versionPrefix = version ? `v${version}` : undefined;
    const path = joinPath("/api", versionPrefix, classPath, methodPath);

    routes.push({
      controller: ctrl.name,
      handler: name,
      method: METHOD_NAME[httpMethod] ?? String(httpMethod),
      path: `${METHOD_NAME[httpMethod] ?? httpMethod} ${path}`,
      public: override<boolean>(handler, ctrl, AUTH_PUBLIC_KEY) === true,
      strategies: override<AuthStrategy[]>(handler, ctrl, AUTH_STRATEGIES_KEY),
      guards: [...new Set([...classGuards, ...guardNames(handler)])],
      global: override<GlobalPermissionRequirement[]>(handler, ctrl, REQUIRE_GLOBAL_PERMISSIONS_KEY) ?? [],
      domain: override<DomainPermissionRequirement[]>(handler, ctrl, REQUIRE_DOMAIN_PERMISSIONS_KEY) ?? [],
      serviceEnforced: override<GlobalPermissionRequirement[]>(handler, ctrl, SERVICE_ENFORCED_GLOBAL_PERMISSIONS_KEY) ?? [],
      hasDomainIdParam: path.includes(":domainId"),
    });
  }
  return routes;
}

export function scanAll(controllers: readonly (new (...args: never[]) => unknown)[]): ScannedRoute[] {
  return controllers
    .flatMap((c) => scanController(c))
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

// Compact one-line signature of a route's auth+ACL contract, used both to print
// the discovered cartography and to assert it against the locked expectation.
export function contractLine(r: ScannedRoute): string {
  const perm = (list: { resource: string; actions: readonly string[] }[]) =>
    list.map((e) => `${e.resource}[${e.actions.join(",")}]`).join(" ");
  const auth = r.public ? "PUBLIC" : (r.strategies ?? ["ApiToken", "JWT"]).join("+");
  const g = r.global.length ? ` global:${perm(r.global)}` : "";
  const d = r.domain.length ? ` domain:${perm(r.domain)}` : "";
  const s = r.serviceEnforced.length ? ` svc:${perm(r.serviceEnforced)}` : "";
  return `${r.path}  ::  auth=${auth} guards=[${r.guards.join(",")}]${g}${d}${s}`;
}
