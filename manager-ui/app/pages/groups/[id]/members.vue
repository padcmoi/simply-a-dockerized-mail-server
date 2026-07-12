<script setup lang="ts">
import type { GroupMember } from "~/composables/useGroups";

definePageMeta({
  requiredGlobal: [
    { resource: "groups", action: "access" },
    { resource: "groups", action: "list-group-members" },
  ],
});

const accountOptions = ref<{ label: string; value: string }[]>([]);
const optionsLoading = ref(false);
const accountSearch = ref("");
const addingMember = ref(false);
const bulkLoading = ref(false);

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { isRoot } = usePermissions();
const { set: setBreadcrumb } = useBreadcrumb();
const { addMembers, removeMember, addAllMembers, removeAllMembers } = useGroups();

const groupId = computed(() => String(route.params.id));
const { group, loading: groupLoading, refresh: refreshGroup } = useGroupDetail(groupId);

// Same server-side paginated + searchable list as every other table (10/25/50
// page size, 1s-debounced search). The member list is kept as a div list, not a
// table, so no clickable sort headers and no sortableColumns on the toolbar.
const {
  items: members,
  total,
  loading,
  hasLoadedOnce,
  page,
  limit,
  search,
  sortBy,
  sortDir,
  load,
} = usePaginatedList<GroupMember>("group-members", () => `/groups/${groupId.value}/members`, "username", [groupId]);
sortDir.value = "asc";

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.groups"), to: "/groups" },
    { label: group.value?.name ?? "...", to: `/groups/${groupId.value}` },
    { label: t("groups.detail.tabs.members") },
  ]);
});

// Server-side typeahead: fetches only the top matches among accounts NOT already
// in this group -- never the whole account table (would be brutal at thousands
// of accounts). Re-runs on each debounced keystroke (see accountSearch) and
// after every membership change, always for the current search term.
async function loadAccountOptions() {
  optionsLoading.value = true;
  try {
    const qs = new URLSearchParams({ notInGroup: groupId.value, limit: "25" });
    if (accountSearch.value) qs.set("search", accountSearch.value);
    const accounts = await call<{ id: string; username: string; name: string | null }[]>(`/accounts/names?${qs.toString()}`);
    accountOptions.value = accounts.map((a) => ({ label: a.name ? `${a.username} (${a.name})` : a.username, value: a.id }));
  } catch (e) {
    toast.add({ title: t("groups.detail.members.addFailed"), description: (e as Error).message, color: "error" });
  } finally {
    optionsLoading.value = false;
  }
}

function onSearchAccounts(term: string) {
  accountSearch.value = term;
  loadAccountOptions();
}

async function onAddMembers(accountIds: string[]) {
  if (accountIds.length === 0) return;
  addingMember.value = true;
  try {
    await addMembers(groupId.value, accountIds);
    await load();
    await refreshGroup();
    await loadAccountOptions();
  } catch (e) {
    toast.add({ title: t("groups.detail.members.addFailed"), description: (e as Error).message, color: "error" });
  } finally {
    addingMember.value = false;
  }
}

async function onRemoveMember(accountId: string) {
  try {
    await removeMember(groupId.value, accountId);
    await load();
    await refreshGroup();
    await loadAccountOptions();
  } catch (e) {
    toast.add({ title: t("groups.detail.members.removeFailed"), description: (e as Error).message, color: "error" });
  }
}

async function onAssignAll() {
  bulkLoading.value = true;
  try {
    await addAllMembers(groupId.value);
    await load();
    await refreshGroup();
    await loadAccountOptions();
    toast.add({ title: t("groups.detail.members.assignAllDone"), color: "success" });
  } catch (e) {
    toast.add({ title: t("groups.detail.members.assignAllFailed"), description: (e as Error).message, color: "error" });
  } finally {
    bulkLoading.value = false;
  }
}

async function onRemoveAll() {
  bulkLoading.value = true;
  try {
    await removeAllMembers(groupId.value);
    await load();
    await refreshGroup();
    await loadAccountOptions();
    toast.add({ title: t("groups.detail.members.removeAllDone"), color: "success" });
  } catch (e) {
    toast.add({ title: t("groups.detail.members.removeAllFailed"), description: (e as Error).message, color: "error" });
  } finally {
    bulkLoading.value = false;
  }
}

onMounted(loadAccountOptions);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-users"
      :title="t('groups.detail.alerts.members.title')"
      :description="t('groups.detail.alerts.members.description')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/groups" size="sm">
      {{ t("groups.backToList") }}
    </UButton>

    <div v-if="groupLoading && !group" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <template v-else-if="group">
      <GroupDetailTabs :group-id="groupId" active="members" :group-name="group.name" :is-protected="group.protected" />

      <GroupMembersCard
        :members="members"
        :account-options="accountOptions"
        :options-loading="optionsLoading"
        :adding="addingMember"
        :is-root="isRoot"
        :bulk-loading="bulkLoading"
        :loading="loading"
        :has-loaded-once="hasLoadedOnce"
        :searching="search.length > 0"
        :member-total="group.memberCount"
        :non-member-total="group.nonMemberCount"
        @add="onAddMembers"
        @remove="onRemoveMember"
        @add-all="onAssignAll"
        @remove-all="onRemoveAll"
        @search-accounts="onSearchAccounts"
      >
        <template #toolbar>
          <ListToolbar v-model:search="search" v-model:limit="limit" :sort-by="sortBy" :sort-dir="sortDir" :total="total" />
        </template>
      </GroupMembersCard>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>
  </div>
</template>
