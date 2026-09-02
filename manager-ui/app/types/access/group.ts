// Groups, their members, and the permission catalogue they are edited against.

export interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  ownerId: string | null;
  ownerEmail: string | null;
  memberCount: number;
  isDefault?: boolean;
  protected?: boolean;
  // Root-only flag; a non-root never receives an invisible group from the API,
  // so this is only ever present/true in a root session.
  invisible?: boolean;
}

export interface GroupPermission {
  id: string;
  resource: string;
  action: string;
}

export interface GroupDomainPermission {
  id: string;
  domainId: number;
  domainName: string;
  resource: string;
  action: string;
}

export interface GroupDetail extends GroupItem {
  owner: { id: string; email: string } | null;
  // Accounts not in this group (= assignable). Server COUNT, only on the detail.
  nonMemberCount: number;
  globalPermissions: GroupPermission[];
  domainPermissions: GroupDomainPermission[];
}

export interface GroupMember {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface DependsOnEntry {
  resource: string;
  action: string[];
}

export type ResourceDependsOn = { resource: string; dependsOn: DependsOnEntry[] }[];

// Shape of GET /groups/permissions/catalog -- see GroupsController.getPermissionsCatalog.
// `actionsByResource` is keyed by resource, deliberately not a flat list: two
// resources no longer share one vocabulary, so a grid asks each resource what it
// offers rather than assuming five columns.
export interface PermissionsCatalogTier {
  resources: string[];
  actionsByResource: Record<string, string[]>;
  dependsOn?: ResourceDependsOn;
}

export interface PermissionsCatalog {
  global: PermissionsCatalogTier;
  domain: PermissionsCatalogTier;
}

export type GroupDetailSection = "info" | "owner" | "members" | "application" | "domain";
