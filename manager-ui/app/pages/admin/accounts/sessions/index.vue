<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "view-account-sessions" },
  ],
});

interface AccountSessionSummary {
  accountId: string;
  email: string | null;
  displayName: string | null;
  activeCount: number;
  expiredCount: number;
  online: boolean;
  // Last-seen among the account's active sessions: the active section's
  // "seen X ago" once it is no longer online.
  lastSeenAt: string | null;
  // Last-seen among the account's expired sessions: the expired table's column.
  // Kept distinct so an expired row never borrows the active session's time.
  expiredLastSeenAt: string | null;
}

const { t } = useI18n();
const { call } = useApi();
const { timeAgo } = useDateTime();
const { isOnline, lastSeenAt } = usePresence();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.accounts"), to: "/admin/accounts" }, { label: t("accounts.allSessions.label") }]);

const overview = ref<AccountSessionSummary[]>([]);
const loading = ref(false);
const loaded = ref(false);

const activeAccounts = computed(() => overview.value.filter((a) => a.activeCount > 0));
const expiredAccounts = computed(() => overview.value.filter((a) => a.expiredCount > 0));

// The overview is a single fetch of every account, so DataTable holds the whole
// list: searching, sorting and paging happen inside it, over these columns, and
// it decides on its own width whether this is a table or a block per account.
const expiredColumns = computed<DataTableColumn<AccountSessionSummary>[]>(() => [
  { key: "account", label: t("accounts.allSessions.colAccount"), value: (row) => accountLabel(row), primary: true },
  { key: "expiredCount", label: t("accounts.allSessions.colExpired"), value: (row) => row.expiredCount },
  { key: "expiredLastSeenAt", label: t("accounts.allSessions.colLastSeen"), value: (row) => row.expiredLastSeenAt ?? "" },
]);

// Reload on the shared refresh tick (header button, focus, heartbeat).
const realtimeOverview = useRealtimeTopic<AccountSessionSummary[]>("sessions-overview");
watch(realtimeOverview, (v) => {
  if (v) {
    overview.value = v;
    loaded.value = true;
  }
});
watch(useDataRefresh().tick, () => load());

async function load() {
  loading.value = true;
  try {
    overview.value = await call<AccountSessionSummary[]>("/accounts/sessions/overview");
  } catch (e) {
    toast.add({ title: t("accounts.allSessions.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

function accountLabel(a: AccountSessionSummary) {
  return a.displayName || a.email || a.accountId;
}

function lastSeenLabel(a: AccountSessionSummary) {
  return (a.expiredLastSeenAt ? timeAgo(a.expiredLastSeenAt) : null) ?? "-";
}

function openActive(a: AccountSessionSummary) {
  navigateTo(`/admin/accounts/sessions/${a.accountId}/active`);
}

function openExpired(a: AccountSessionSummary) {
  navigateTo(`/admin/accounts/sessions/${a.accountId}/expired`);
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-monitor"
      :title="t('accounts.allSessions.alertTitle')"
      :description="t('accounts.allSessions.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/accounts" size="sm">
      {{ t("accounts.backToList") }}
    </UButton>

    <!-- Container 1: active sessions grouped by account -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("accounts.allSessions.activeTitle") }}</h2>
      </template>

      <div v-if="loading && !loaded" class="space-y-3 py-1">
        <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <UEmptyState
        v-else-if="activeAccounts.length === 0"
        icon="i-lucide-monitor"
        :title="t('accounts.allSessions.activeEmpty')"
      />

      <ul v-else class="divide-y divide-default">
        <li
          v-for="a in activeAccounts"
          :key="a.accountId"
          class="py-3 flex items-center gap-3 cursor-pointer hover:bg-elevated/40 -mx-2 px-2 rounded-md transition-colors"
          @click="openActive(a)"
        >
          <PresenceAvatar
            :alt="accountLabel(a)"
            :online="isOnline(a.accountId)"
            :last-seen-at="lastSeenAt(a.accountId)"
            size="sm"
            class="shrink-0"
          />
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ accountLabel(a) }}</p>
            <p v-if="a.displayName && a.email" class="text-xs text-muted truncate">{{ a.email }}</p>
          </div>
          <SessionPresence :online="a.online" :last-seen-at="a.lastSeenAt" />
          <UBadge color="primary" variant="subtle" class="shrink-0">
            {{ t("accounts.allSessions.activeCount", { count: a.activeCount }) }}
          </UBadge>
          <UIcon name="i-lucide-arrow-right" class="text-muted shrink-0" />
        </li>
      </ul>
    </UCard>

    <!-- Container 2: expired sessions grouped by account, as a table like /profile/sessions -->
    <div class="space-y-4">
      <h2 class="font-semibold">{{ t("accounts.allSessions.expiredTitle") }}</h2>

      <ListSkeleton v-if="!loaded" :columns="3" />

      <UEmptyState
        v-else-if="expiredAccounts.length === 0"
        icon="i-lucide-history"
        :title="t('accounts.allSessions.expiredEmpty')"
      />

      <DataTable
        v-else
        :data="expiredAccounts"
        :columns="expiredColumns"
        :row-key="(row: AccountSessionSummary) => row.accountId"
        sort-key="expiredCount"
        sort-direction="desc"
        :empty-label="t('common.noResults')"
      >
        <template #account="{ row }">
          <button type="button" class="flex items-center gap-2 text-left group min-w-0" @click="openExpired(row)">
            <PresenceAvatar
              :alt="accountLabel(row)"
              :online="isOnline(row.accountId)"
              :last-seen-at="lastSeenAt(row.accountId)"
              size="xs"
              class="shrink-0"
            />
            <span class="min-w-0">
              <span class="block font-medium truncate group-hover:text-primary transition-colors">
                {{ accountLabel(row) }}
              </span>
              <span v-if="row.displayName && row.email" class="block text-xs text-muted truncate">{{ row.email }}</span>
            </span>
          </button>
        </template>

        <template #expiredCount="{ row }">
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ t("accounts.allSessions.expiredCount", { count: row.expiredCount }) }}
          </UBadge>
        </template>

        <template #expiredLastSeenAt="{ row }">
          <span class="text-muted">{{ lastSeenLabel(row) }}</span>
        </template>

        <template #actions="{ row }">
          <UButton
            icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
            size="xs"
            :title="t('accounts.allSessions.viewDetails')"
            @click="openExpired(row)"
          />
        </template>
      </DataTable>
    </div>
  </div>
</template>
