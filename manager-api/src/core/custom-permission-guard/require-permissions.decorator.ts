import { SetMetadata } from "@nestjs/common";

export interface PermissionRequirement {
  resource: string;
  actions: string[];
}

export const REQUIRE_GLOBAL_PERMISSIONS_KEY = "__require_global_permissions__";
export const REQUIRE_DOMAIN_PERMISSIONS_KEY = "__require_domain_permissions__";

// Everything declared is mandatory: AND across entries, AND across each
// entry's actions. A single missing (resource, action) pair refuses the
// route. `root` always bypasses both (see Global/DomainPermissionGuard) --
// the lib itself never sees or knows about root.
export const RequireGlobalPermissions = (requirements: PermissionRequirement[]) =>
  SetMetadata(REQUIRE_GLOBAL_PERMISSIONS_KEY, requirements);

export const RequireDomainPermissions = (requirements: PermissionRequirement[]) =>
  SetMetadata(REQUIRE_DOMAIN_PERMISSIONS_KEY, requirements);
