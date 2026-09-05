<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "list-accounts" },
  ],
});

const {
  items: accounts,
  total,
  loading,
  hasLoadedOnce,
  page,
  limit,
  search,
  searchBy,
  sortBy,
  sortDir,
  load,
} = usePaginatedList<ManagerAccount>("accounts-list", "/accounts", "createdAt");

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);

// The account whose second factor is about to be removed: the way back in
// for someone whose phone and recovery codes are both gone. Ten clicks, like
// a deletion, since it strips what protects that account's sign-in.
const resetTwoFactorOpen = ref(false);
const resetTwoFactorTarget = ref<ManagerAccount | null>(null);

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
const canResetTwoFactor = computed(() => isRoot.value || hasGlobal("accounts", "edit-account"));

const inviteMenu = computed(() => [
  [
    { label: t("accounts.invite.byEmail"), icon: "i-lucide-mail", to: "/admin/accounts/create/email" },
    { label: t("accounts.invite.byToken"), icon: "i-lucide-key-round", to: "/admin/accounts/create/token" },
  ],
]);

// `group` has no matching real column (computed post-query, see
// accounts.service.ts's enrichWithGroups) -- not sortable, stays a plain
// header. Same source feeds the desktop column headers below and

// Declared once for both renderings, which DataTable chooses between on its own
// width. The groups a member belongs to are read from a joined list and the API
// has no column to order by, hence the one column that says so.
const columns = computed<DataTableColumn<ManagerAccount>[]>(() => [
  { key: "email", label: t("accounts.table.email"), value: (row) => row.email, primary: true },
  { key: "displayName", label: t("accounts.table.name"), value: (row) => row.displayName ?? "" },
  {
    key: "group",
    label: t("accounts.table.group"),
    value: (row) => row.groups.map((group) => group.name).join(", "),
    sortable: false,
    searchable: false,
  },
  { key: "enabled", label: t("accounts.table.status"), value: (row) => row.enabled, searchable: false },
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

function requestResetTwoFactor(acc: ManagerAccount) {
  resetTwoFactorTarget.value = acc;
  resetTwoFactorOpen.value = true;
}

async function onResetTwoFactorConfirmed() {
  const acc = resetTwoFactorTarget.value;
  resetTwoFactorTarget.value = null;
  if (!acc) return;
  try {
    await call(`/accounts/${acc.id}/two-factor`, { method: "DELETE" });
    toast.add({ title: t("accounts.overviewPage.toast.twoFactorReset"), color: "success" });
    await load();
  } catch (e) {
    toast.add({
      title: t("accounts.overviewPage.toast.twoFactorResetFailed"),
      description: (e as Error).message,
      color: "error",
    });
  }
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
      to="/admin/accounts/sessions"
      class="w-full sm:max-w-md"
    />

    <div class="flex items-center justify-end gap-2">
      <UDropdownMenu v-if="canInvite" :items="inviteMenu">
        <UButton icon="i-lucide-user-plus" color="primary" trailing-icon="i-lucide-chevron-down">
          {{ t("accounts.inviteButton") }}
        </UButton>
      </UDropdownMenu>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="4" />

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:search-by="searchBy"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      :data="accounts"
      :columns="columns"
      :total="total"
      :loading="loading"
      :row-key="(row: ManagerAccount) => row.id"
      :empty-label="t('common.noResults')"
    >
      <template #email="{ row }">
        <div class="flex items-center gap-2 min-w-0">
          <UAvatar :src="row.avatarUrl ?? undefined" :alt="row.displayName ?? row.email" size="xs" class="shrink-0" />
          <NuxtLink
            :to="`/admin/accounts/${row.id}`"
            class="font-medium text-primary hover:underline underline-offset-2 transition-colors truncate min-w-0"
          >
            {{ row.email }}
          </NuxtLink>
          <UBadge v-if="row.isRoot" color="warning" variant="subtle" size="xs" class="shrink-0">root</UBadge>
        </div>
      </template>

      <template #displayName="{ row }">
        <span class="text-muted">{{ row.displayName ?? "-" }}</span>
      </template>

      <template #group="{ row }">
        <div v-if="row.isRoot" class="text-xs text-muted italic">
          {{ t("accounts.table.rootAccess") }}
        </div>
        <div v-else-if="row.groups.length" class="flex flex-wrap gap-1">
          <UBadge v-for="g in row.groups" :key="g.id" color="neutral" variant="subtle" size="xs" class="max-w-40" :title="g.name">
            <span class="truncate min-w-0">{{ g.name }}</span>
          </UBadge>
        </div>
        <span v-else class="text-xs text-dimmed">{{ t("accounts.table.noGroup") }}</span>
      </template>

      <template #enabled="{ row }">
        <UBadge :color="row.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
          {{ row.enabled ? t("common.active") : t("common.inactive") }}
        </UBadge>
      </template>

      <template #actions="{ row }">
        <UButton
          v-if="row.twoFactorEnabled && canResetTwoFactor"
          icon="i-lucide-shield-off"
          size="xs"
          color="warning"
          variant="ghost"
          :title="t('accounts.table.resetTwoFactor')"
          @click="requestResetTwoFactor(row)"
        />
        <UButton
          v-if="!row.isRoot && canEditAccount"
          icon="i-lucide-users-round"
          size="xs"
          color="neutral"
          variant="ghost"
          :title="t('accounts.table.manageGroups')"
          :to="`/admin/accounts/${row.id}/groups`"
        />
        <UButton
          v-if="!row.isRoot && canEditAccount"
          icon="i-lucide-pencil"
          size="xs"
          color="neutral"
          variant="ghost"
          :title="t('accounts.table.editAccount')"
          :to="`/admin/accounts/${row.id}/edit`"
        />
        <UButton
          v-if="!row.isRoot && canRevokeAccount"
          icon="i-lucide-trash-2"
          size="xs"
          color="error"
          variant="ghost"
          :title="t('common.delete')"
          @click="requestDelete(() => deleteAccount(row))"
        />
      </template>
    </DataTable>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="t('accounts.confirmDelete')"
      :description="t('accounts.confirmDeleteHint')"
      @confirm="onDeleteConfirmed"
    />

    <ConfirmModal
      v-model:open="resetTwoFactorOpen"
      type="warning"
      :title="t('accounts.overviewPage.actions.resetTwoFactor')"
      :description="t('accounts.overviewPage.resetTwoFactorConfirm')"
      @confirm="onResetTwoFactorConfirmed"
    />
  </div>
</template>
