<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "read" },
  ],
});

interface ManagerAccount {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  isRoot: boolean;
  enabled: boolean;
  lastLogin: string | null;
  createdAt: string;
  groups: { id: number; name: string }[];
}

const { items: accounts, total, loading, page, limit, search, sortDir, load } = usePaginatedList<ManagerAccount>("/accounts");

const inviteOpen = ref(false);
const inviteSending = ref(false);

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.accounts") }]);
const auth = useAuthStore();
const { groups } = useGroups();

const groupInviteOptions = computed(() => groups.value.map((g) => ({ label: g.name, value: g.id })));

const columns = computed(() => [
  { accessorKey: "username", header: t("accounts.table.username") },
  { accessorKey: "name", header: t("accounts.table.name") },
  { accessorKey: "email", header: t("accounts.table.email") },
  { id: "group", header: t("accounts.table.group") },
  { id: "status", header: t("accounts.table.status") },
  { id: "actions", header: "" },
]);

async function sendInvite(data: { email: string; groupId: number | null }) {
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
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-users"
      :title="t('accounts.alertTitle')"
      :description="t('accounts.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <div class="flex items-center justify-between gap-2">
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
      <UButton
        v-if="auth.session?.isRoot"
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

    <ListToolbar v-model:search="search" v-model:limit="limit" v-model:sort-dir="sortDir" />

    <UCard class="hidden lg:block">
      <UTable :loading="loading" :data="accounts" :columns="columns" sticky>
        <template #username-cell="{ row }">
          <div class="flex items-center gap-2">
            <UAvatar :alt="row.original.name ?? row.original.username" size="xs" />
            <span class="font-medium">{{ row.original.username }}</span>
            <UBadge v-if="row.original.isRoot" color="warning" variant="subtle" size="xs">root</UBadge>
          </div>
        </template>
        <template #name-cell="{ row }">
          <span class="text-muted">{{ row.original.name ?? "-" }}</span>
        </template>
        <template #email-cell="{ row }">
          <span class="text-muted text-sm">{{ row.original.email ?? "-" }}</span>
        </template>
        <template #group-cell="{ row }">
          <div v-if="row.original.isRoot" class="text-xs text-muted italic">
            {{ t("accounts.table.rootAccess") }}
          </div>
          <div v-else-if="row.original.groups.length" class="flex flex-wrap gap-1">
            <UBadge v-for="g in row.original.groups" :key="g.id" color="neutral" variant="subtle" size="xs">{{ g.name }}</UBadge>
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
              v-if="!row.original.isRoot"
              icon="i-lucide-users-round"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="t('accounts.table.manageGroups')"
              :to="`/accounts/${row.original.id}/groups`"
            />
            <UButton
              v-if="!row.original.isRoot"
              icon="i-lucide-pencil"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="t('accounts.table.editAccount')"
              :to="`/accounts/${row.original.id}`"
            />
            <UButton
              v-if="!row.original.isRoot && row.original.enabled"
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

    <div class="lg:hidden space-y-3">
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="accounts.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
      <AccountCard
        v-for="acc in accounts"
        v-else
        :key="acc.id"
        :account="acc"
        @revoke="requestDelete(() => revokeAccount(acc))"
      />
    </div>

    <div class="flex justify-center">
      <UPagination v-model:page="page" :total="total" :items-per-page="limit" />
    </div>

    <AccountInviteModal
      v-model:open="inviteOpen"
      :group-options="groupInviteOptions"
      :sending="inviteSending"
      @submit="sendInvite"
    />

    <ConfirmModal v-model:open="confirmOpen" :title="t('accounts.confirmRevoke')" @confirm="onDeleteConfirmed" />
  </div>
</template>
