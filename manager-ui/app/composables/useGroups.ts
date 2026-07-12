export interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  ownerId: string | null;
  ownerUsername: string | null;
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
  owner: { id: string; username: string } | null;
  // Accounts not in this group (= assignable). Server COUNT, only on the detail.
  nonMemberCount: number;
  globalPermissions: GroupPermission[];
  domainPermissions: GroupDomainPermission[];
}

export interface GroupMember {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
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

export function useGroups() {
  const { call } = useApi();
  const { t } = useI18n();
  const toast = useToast();

  const groups = ref<GroupItem[]>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      groups.value = await call<GroupItem[]>("/groups");
    } catch {
      toast.add({ title: t("groups.toast.loadFailed"), color: "error" });
    } finally {
      loading.value = false;
    }
  }

  async function create(input: { name: string; description?: string | null; isDefault?: boolean }) {
    const created = await call<GroupItem>("/groups", { method: "POST", body: input });
    groups.value.push(created);
    groups.value.sort((a, b) => a.name.localeCompare(b.name));
    return created;
  }

  async function update(
    id: string,
    input: { name?: string; description?: string | null; isDefault?: boolean; protected?: boolean; invisible?: boolean }
  ) {
    const updated = await call<GroupItem>(`/groups/${id}`, { method: "PATCH", body: input });
    const idx = groups.value.findIndex((g) => g.id === id);
    if (idx !== -1) {
      const g = groups.value[idx];
      if (g) Object.assign(g, updated);
    }
    return updated;
  }

  async function remove(id: string) {
    await call(`/groups/${id}`, { method: "DELETE" });
    groups.value = groups.value.filter((g) => g.id !== id);
  }

  async function getDetail(id: string) {
    return call<GroupDetail>(`/groups/${id}`);
  }

  async function setGlobalPermissions(id: string, permissions: { resource: string; action: string }[]) {
    return call<GroupDetail>(`/groups/${id}/global-permissions`, { method: "PUT", body: { permissions } });
  }

  async function setDomainPermissions(id: string, permissions: { domainId: number; resource: string; action: string }[]) {
    return call<GroupDetail>(`/groups/${id}/domain-permissions`, { method: "PUT", body: { permissions } });
  }

  async function updateOwner(id: string, newOwnerId: string) {
    return call<GroupDetail>(`/groups/${id}/owner`, { method: "PATCH", body: { newOwnerId } });
  }

  async function listMembers(id: string) {
    return call<GroupMember[]>(`/groups/${id}/members`);
  }

  async function addMember(id: string, accountId: string) {
    return call<GroupMember[]>(`/groups/${id}/members`, { method: "POST", body: { accountId } });
  }

  // Bulk add (members picker multi-select) -- one call for several accounts.
  async function addMembers(id: string, accountIds: string[]) {
    return call<{ added: number }>(`/groups/${id}/members/bulk`, { method: "POST", body: { accountIds } });
  }

  async function removeMember(id: string, accountId: string) {
    return call<GroupMember[]>(`/groups/${id}/members/${accountId}`, { method: "DELETE" });
  }

  // Root-only bulk ops (server enforces isRoot). addAll is idempotent: re-running
  // also picks up accounts created since the last run.
  async function addAllMembers(id: string) {
    return call<GroupMember[]>(`/groups/${id}/members/all`, { method: "POST" });
  }

  async function removeAllMembers(id: string) {
    return call<GroupMember[]>(`/groups/${id}/members/all`, { method: "DELETE" });
  }

  watch(useDataRefresh().tick, load);
  onMounted(load);

  return {
    groups,
    loading,
    load,
    create,
    update,
    remove,
    getDetail,
    setGlobalPermissions,
    setDomainPermissions,
    updateOwner,
    listMembers,
    addMember,
    addMembers,
    removeMember,
    addAllMembers,
    removeAllMembers,
  };
}
