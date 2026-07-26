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

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.accounts") }]);
const { isRoot, hasGlobal } = usePermissions();

// The API now gates these routes on `accounts:*` rather than IsRootGuard, so the
// buttons follow the actual permission instead of assuming root. Hiding an entry
// point beats letting the click land on a 403.
const canInvite = computed(() => isRoot.value || hasGlobal("accounts", "invite-account"));
const canEditAccount = computed(() => isRoot.value || hasGlobal("accounts", "view-account"));
const canRevokeAccount = computed(() => isRoot.value || hasGlobal("accounts", "revoke-account"));
const canViewSessions = computed(() => isRoot.value || hasGlobal("accounts", "view-account-sessions"));

const inviteMenu = computed(() => [
  [
    { label: t("accounts.invite.byEmail"), icon: "i-lucide-mail", to: "/accounts/create/email" },
    { label: t("accounts.invite.byToken"), icon: "i-lucide-key-round", to: "/accounts/create/token" },
  ],
]);

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

async function deleteAccount(acc: ManagerAccount) {
  try {
    await call(`/accounts/${acc.id}`, { method: "DELETE" });
    toast.add({ title: t("accounts.toast.deleted"), color: "success" });
    await load();
  } catch {
    toast.add({ title: t("accounts.toast.deleteFailed"), color: "error" });
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

    <ProfileActionCard
      v-if="canViewSessions"
      icon="i-lucide-monitor"
      icon-color="text-warning"
      :label="t('accounts.allSessions.label')"
      :hint="t('accounts.allSessions.hint')"
      to="/accounts/sessions"
      class="w-full sm:max-w-md"
    />

    <div class="flex items-center justify-end gap-2">
      <UDropdownMenu v-if="canInvite" :items="inviteMenu">
        <UButton icon="i-lucide-user-plus" color="primary" trailing-icon="i-lucide-chevron-down">
          {{ t("accounts.inviteButton") }}
        </UButton>
      </UDropdownMenu>
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
              <NuxtLink
                :to="`/accounts/${row.original.id}`"
                class="font-medium text-primary hover:underline underline-offset-2 transition-colors"
              >
                {{ row.original.email }}
              </NuxtLink>
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
              <UBadge
                v-for="g in row.original.groups"
                :key="g.id"
                color="neutral"
                variant="subtle"
                size="xs"
                class="max-w-40"
                :title="g.name"
              >
                <span class="truncate min-w-0">{{ g.name }}</span>
              </UBadge>
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
                :to="`/accounts/${row.original.id}/edit`"
              />
              <UButton
                v-if="!row.original.isRoot && canRevokeAccount"
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                :title="t('common.delete')"
                @click="requestDelete(() => deleteAccount(row.original))"
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
          @delete="requestDelete(() => deleteAccount(acc))"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="t('accounts.confirmDelete')"
      :description="t('accounts.confirmDeleteHint')"
      @confirm="onDeleteConfirmed"
    />
  </div>
</template>
