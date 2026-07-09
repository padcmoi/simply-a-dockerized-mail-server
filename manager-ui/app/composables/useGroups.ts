export interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  ownerId: string | null;
  ownerUsername: string | null;
  memberCount: number;
  isDefault?: boolean;
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
export interface PermissionsCatalog {
  global: { resources: string[]; actions: string[]; dependsOn?: ResourceDependsOn };
  domain: { resources: string[]; actions: string[]; dependsOn?: ResourceDependsOn };
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

  async function update(id: string, input: { name?: string; description?: string | null; isDefault?: boolean }) {
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

  async function removeMember(id: string, accountId: string) {
    return call<GroupMember[]>(`/groups/${id}/members/${accountId}`, { method: "DELETE" });
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
    removeMember,
  };
}
