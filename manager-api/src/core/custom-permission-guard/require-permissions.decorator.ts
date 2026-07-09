import { SetMetadata } from "@nestjs/common";
import { GLOBAL_RESOURCES, DOMAIN_RESOURCES, PERMISSION_ACTIONS } from "./permission-catalog";

export interface GlobalPermissionRequirement {
  resource: (typeof GLOBAL_RESOURCES)[number];
  actions: (typeof PERMISSION_ACTIONS)[number][];
}

export interface DomainPermissionRequirement {
  resource: (typeof DOMAIN_RESOURCES)[number];
  actions: (typeof PERMISSION_ACTIONS)[number][];
}

export const REQUIRE_GLOBAL_PERMISSIONS_KEY = "__require_global_permissions__";
export const REQUIRE_DOMAIN_PERMISSIONS_KEY = "__require_domain_permissions__";

// Everything declared is mandatory: AND across entries, AND across each
// entry's actions. A single missing (resource, action) pair refuses the
// route. `root` always bypasses both (see Global/DomainPermissionGuard) --
// the lib itself never sees or knows about root.
export const RequireGlobalPermissions = (requirements: GlobalPermissionRequirement[]) =>
  SetMetadata(REQUIRE_GLOBAL_PERMISSIONS_KEY, requirements);

export const RequireDomainPermissions = (requirements: DomainPermissionRequirement[]) =>
  SetMetadata(REQUIRE_DOMAIN_PERMISSIONS_KEY, requirements);
