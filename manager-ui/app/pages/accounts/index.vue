<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "list-accounts" },
  ],
});

interface ManagerAccount {
  id: string;
  email: string;
  displayName: string | null;
  isRoot: boolean;
  enabled: boolean;
  lastLogin: string | null;
  createdAt: string;
  groups: { id: string; name: string }[];
}

const {
  items: accounts,
  total,
  loading,
  hasLoadedOnce,
  page,
  limit,
  search,
  sortBy,
  sortDir,
  load,
} = usePaginatedList<ManagerAccount>("accounts-list", "/accounts", "createdAt");
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

const inviteOpen = ref(false);
const inviteSending = ref(false);

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.accounts") }]);
const { isRoot, hasGlobal } = usePermissions();
const { groups } = useGroups();

// The API now gates these routes on `accounts:*` rather than IsRootGuard, so the
// buttons follow the actual permission instead of assuming root. Hiding an entry
// point beats letting the click land on a 403.
const canInvite = computed(() => isRoot.value || hasGlobal("accounts", "invite-account"));
const canEditAccount = computed(() => isRoot.value || hasGlobal("accounts", "view-account"));
const canRevokeAccount = computed(() => isRoot.value || hasGlobal("accounts", "revoke-account"));

const groupInviteOptions = computed(() => groups.value.map((g) => ({ label: g.name, value: g.id })));

// `group` has no matching real column (computed post-query, see
// accounts.service.ts's enrichWithGroups) -- not sortable, stays a plain
// header. Same source feeds the desktop column headers below and
// ListToolbar's mobile sort select.
const SORTABLE_COLUMNS = computed(() => [
  { key: "email", label: t("accounts.table.email") },
  { key: "displayName", label: t("accounts.table.name") },
  { key: "enabled", label: t("accounts.table.status") },
]);

const columns = computed(() => [
  { accessorKey: "email", header: header("email", t("accounts.table.email")) },
  { accessorKey: "displayName", header: header("displayName", t("accounts.table.name")) },
  { id: "group", header: t("accounts.table.group") },
  { id: "status", header: header("enabled", t("accounts.table.status")) },
  { id: "actions", header: "" },
]);

async function sendInvite(data: { email: string; groupId: string | null }) {
  inviteSending.value = true;
  try {
    await call("/accounts/invite", { method: "POST", body: data });
    toast.add({ title: t("accounts.toast.invited"), color: "success" });
    inviteOpen.value = false;
    await load();
  } catch {
    toast.add({ title: t("accounts.toast.inviteFailed"), color: "error" });
  } finally {
    inviteSending.value = false;
  }
}

async function revokeAccount(acc: ManagerAccount) {
  try {
    await call(`/accounts/${acc.id}`, { method: "DELETE" });
    toast.add({ title: t("accounts.toast.revoked"), color: "success" });
    await load();
  } catch {
    toast.add({ title: t("accounts.toast.revokeFailed"), color: "error" });
  }
}

function requestDelete(fn: () => Promise<void>) {
  pendingDeleteFn.value = fn;
  confirmOpen.value = true;
}

async function onDeleteConfirmed() {
  await pendingDeleteFn.value?.();
  pendingDeleteFn.value = null;
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-users"
      :title="t('accounts.alertTitle')"
      :description="t('accounts.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <div class="flex items-center justify-between gap-2">
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="() => load()" />
      <UButton
        v-if="canInvite"
        icon="i-lucide-mail-plus"
        color="primary"
        @click="
          () => {
            inviteOpen = true;
          }
        "
      >
        {{ t("accounts.inviteButton") }}
      </UButton>
    </div>

    <ListToolbar
      v-model:search="search"
      v-model:limit="limit"
      v-model:sort-by="sortBy"
      v-model:sort-dir="sortDir"
      :total="total"
      :sortable-columns="SORTABLE_COLUMNS"
    />

    <ListSkeleton v-if="!hasLoadedOnce" :columns="5" />

    <template v-else>
      <UCard class="hidden xl:block">
        <UTable :loading="loading" :data="accounts" :columns="columns" sticky>
          <template #email-cell="{ row }">
            <div class="flex items-center gap-2">
              <UAvatar :alt="row.original.displayName ?? row.original.email" size="xs" />
              <span class="font-medium">{{ row.original.email }}</span>
              <UBadge v-if="row.original.isRoot" color="warning" variant="subtle" size="xs">root</UBadge>
            </div>
          </template>
          <template #displayName-cell="{ row }">
            <span class="text-muted">{{ row.original.displayName ?? "-" }}</span>
          </template>
          <template #group-cell="{ row }">
            <div v-if="row.original.isRoot" class="text-xs text-muted italic">
              {{ t("accounts.table.rootAccess") }}
            </div>
            <div v-else-if="row.original.groups.length" class="flex flex-wrap gap-1">
              <UBadge v-for="g in row.original.groups" :key="g.id" color="neutral" variant="subtle" size="xs">{{
                g.name
              }}</UBadge>
            </div>
            <span v-else class="text-xs text-dimmed">{{ t("accounts.table.noGroup") }}</span>
          </template>
          <template #status-cell="{ row }">
            <UBadge :color="row.original.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
              {{ row.original.enabled ? t("common.active") : t("common.inactive") }}
            </UBadge>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-1 justify-end">
              <UButton
                v-if="!row.original.isRoot && canEditAccount"
                icon="i-lucide-users-round"
                size="xs"
                color="neutral"
                variant="ghost"
                :title="t('accounts.table.manageGroups')"
                :to="`/accounts/${row.original.id}/groups`"
              />
              <UButton
                v-if="!row.original.isRoot && canEditAccount"
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                :title="t('accounts.table.editAccount')"
                :to="`/accounts/${row.original.id}`"
              />
              <UButton
                v-if="!row.original.isRoot && row.original.enabled && canRevokeAccount"
                icon="i-lucide-user-x"
                size="xs"
                color="error"
                variant="ghost"
                :title="t('common.revoke')"
                @click="requestDelete(() => revokeAccount(row.original))"
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <div class="xl:hidden space-y-3">
        <p v-if="accounts.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <AccountCard
          v-for="acc in accounts"
          v-else
          :key="acc.id"
          :account="acc"
          @revoke="requestDelete(() => revokeAccount(acc))"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <AccountInviteModal
      v-model:open="inviteOpen"
      :group-options="groupInviteOptions"
      :sending="inviteSending"
      @submit="sendInvite"
    />

    <ConfirmModal v-model:open="confirmOpen" :title="t('accounts.confirmRevoke')" @confirm="onDeleteConfirmed" />
  </div>
</template>
