import { SetMetadata } from "@nestjs/common";
import type { DomainAction, DomainResource, GlobalAction, GlobalResource } from "./permission-catalog";

// A requirement is a union of one branch per resource, not a free
// (resource, action) pair: `{ resource: "sieve", actions: ["delete-dkim-key"] }`
// is a compile error, and TypeScript names the offending resource. This is what
// keeps the catalog honest -- every route's requirement is checked against the
// actions its resource actually declares.
export type GlobalPermissionRequirement = {
  [R in GlobalResource]: { resource: R; actions: GlobalAction<R>[] };
}[GlobalResource];

export type DomainPermissionRequirement = {
  [R in DomainResource]: { resource: R; actions: DomainAction<R>[] };
}[DomainResource];

export const REQUIRE_GLOBAL_PERMISSIONS_KEY = "__require_global_permissions__";
export const REQUIRE_DOMAIN_PERMISSIONS_KEY = "__require_domain_permissions__";

// Everything declared is mandatory: AND across entries, AND across each
// entry's actions. A single missing (resource, action) pair refuses the
// route. `root` always bypasses both (see Global/DomainPermissionGuard) --
// the lib itself never sees or knows about root.
//
// Listing "access" explicitly is redundant with the lib, which requires it for
// every other action anyway; it is kept so a route's declaration reads as the
// full truth of what it demands, and so a route that needs nothing but `access`
// still has something to declare.
export const RequireGlobalPermissions = (requirements: GlobalPermissionRequirement[]) =>
  SetMetadata(REQUIRE_GLOBAL_PERMISSIONS_KEY, requirements);

export const RequireDomainPermissions = (requirements: DomainPermissionRequirement[]) =>
  SetMetadata(REQUIRE_DOMAIN_PERMISSIONS_KEY, requirements);

export const SERVICE_ENFORCED_GLOBAL_PERMISSIONS_KEY = "__service_enforced_global_permissions__";

// Declares, on the route, an action the GUARD must not enforce because the
// service enforces it as an ALTERNATIVE to something else, never as a second
// condition on top of it. GroupsService's owner-or-root rule is the case that
// needs this: `add-group-member` lets a non-owner do it, so a decorator (which
// ANDs) would take the right away from the very owners it is meant to leave
// alone. The guard ignores this key on purpose.
//
// It exists so the action is still typed against its resource's catalog, still
// shows up in the generated route/permission table, and can never drift into a
// string nobody enforces.
export const ServiceEnforcedGlobalPermissions = (requirements: GlobalPermissionRequirement[]) =>
  SetMetadata(SERVICE_ENFORCED_GLOBAL_PERMISSIONS_KEY, requirements);
