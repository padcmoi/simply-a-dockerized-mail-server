<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "view-account-sessions" },
  ],
});

interface Session {
  id: number;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
  active: boolean;
  online: boolean;
}

interface AccountSummary {
  accountId: string;
  email: string | null;
  displayName: string | null;
  activeCount: number;
  expiredCount: number;
  online: boolean;
}

const route = useRoute();
const { t, locale } = useI18n();
const { call } = useApi();
const { timeAgo } = useDateTime();
const { set: setBreadcrumb } = useBreadcrumb();
const { bump } = useDataRefresh();
const { isRoot, hasGlobal } = usePermissions();
const toast = useToast();

const account = ref<AccountSummary | null>(null);
const confirmOpen = ref(false);
const purging = ref(false);

const userId = computed(() => route.params.userId as string);
const canPurge = computed(() => isRoot.value || hasGlobal("accounts", "purge-account-sessions"));
const accountLabel = computed(() =>
  account.value ? account.value.displayName || account.value.email || userId.value : userId.value
);

// Server-side paginated + searchable + sortable, exactly like /profile/sessions,
// just against the admin per-account history endpoint.
const {
  items: history,
  total,
  loading: historyLoading,
  hasLoadedOnce: historyLoaded,
  page,
  limit,
  search,
  sortBy,
  sortDir,
  load,
} = usePaginatedList<Session>(
  `account-sessions-history-${userId.value}`,
  `/accounts/${userId.value}/sessions/history`,
  "createdAt"
);

// Declared once for both renderings, which DataTable chooses between on its own
// width. The device is read out of a user agent string and the status out of two
// dates: neither is a column the API can order by.
const columns = computed<DataTableColumn<Session>[]>(() => [
  {
    key: "device",
    label: t("profile.sessionsPage.colDevice"),
    value: (row) => deviceLabel(row.userAgent),
    sortable: false,
    primary: true,
  },
  { key: "ip", label: t("profile.sessionsPage.colIp"), value: (row) => row.ip ?? "", sortable: false },
  { key: "createdAt", label: t("profile.sessionsPage.colSignedIn"), value: (row) => row.createdAt },
  { key: "lastSeen", label: t("accounts.allSessions.colLastSeen"), value: (row) => row.lastSeenAt ?? "", sortable: false },
  { key: "expiresAt", label: t("profile.sessionsPage.colEnded"), value: (row) => row.revokedAt ?? row.expiresAt },
  {
    key: "status",
    label: t("profile.sessionsPage.colStatus"),
    value: (row) => (row.revokedAt ? "revoked" : "expired"),
    sortable: false,
  },
]);

watch(
  accountLabel,
  (label) => {
    setBreadcrumb([
      { label: t("nav.accounts"), to: "/admin/accounts" },
      { label: t("accounts.allSessions.label"), to: "/admin/accounts/sessions" },
      { label },
      { label: t("accounts.allSessions.detail.expiredCrumb") },
    ]);
  },
  { immediate: true }
);

function fmt(iso: string) {
  return new Date(iso).toLocaleString(locale.value.replace(/_/g, "-"));
}

function deviceLabel(ua: string | null) {
  const parsed = parseUserAgent(ua);
  if (parsed.browser && parsed.os) {
    return t("profile.sessionsPage.deviceOn", { browser: parsed.browser, os: parsed.os });
  }
  return parsed.browser ?? parsed.os ?? t("profile.sessionsPage.unknownDevice");
}

function deviceIcon(ua: string | null) {
  return parseUserAgent(ua).icon;
}

async function loadAccount() {
  try {
    const overview = await call<AccountSummary[]>("/accounts/sessions/overview");
    account.value = overview.find((a) => a.accountId === userId.value) ?? null;
  } catch {
    account.value = null;
  }
}

async function purge() {
  purging.value = true;
  try {
    await call(`/accounts/${userId.value}/sessions/history`, { method: "DELETE" });
    toast.add({ title: t("accounts.allSessions.toast.purged"), color: "success" });
    await load();
    bump();
  } catch (e) {
    toast.add({ title: t("accounts.allSessions.toast.purgeFailed"), description: (e as Error).message, color: "error" });
  } finally {
    purging.value = false;
  }
}

function askPurge() {
  confirmOpen.value = true;
}

onMounted(loadAccount);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/accounts/sessions" size="sm">
      {{ t("accounts.allSessions.label") }}
    </UButton>

    <div class="flex items-center justify-between gap-2">
      <h2 class="font-semibold">{{ t("accounts.allSessions.detail.expiredTitle", { account: accountLabel }) }}</h2>
      <UButton
        v-if="canPurge && total > 0"
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        size="xs"
        :loading="purging"
        class="shrink-0"
        @click="askPurge"
      >
        {{ t("accounts.allSessions.detail.purge") }}
      </UButton>
    </div>

    <ListSkeleton v-if="!historyLoaded" :columns="6" />

    <UEmptyState v-else-if="total === 0" icon="i-lucide-history" :title="t('accounts.allSessions.expiredEmpty')" />

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      :data="history"
      :columns="columns"
      :total="total"
      :loading="historyLoading"
      :row-key="(row: Session) => row.id"
      :empty-label="t('common.noResults')"
    >
      <template #device="{ row }">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon :name="deviceIcon(row.userAgent)" class="text-muted shrink-0" />
          <span class="truncate" :title="row.userAgent ?? undefined">{{ deviceLabel(row.userAgent) }}</span>
        </div>
      </template>

      <template #ip="{ row }">
        <span class="text-muted">{{ row.ip || t("profile.sessionsPage.unknownIp") }}</span>
      </template>

      <template #createdAt="{ row }">
        <span class="text-muted">{{ fmt(row.createdAt) }}</span>
      </template>

      <template #lastSeen="{ row }">
        <span class="text-muted" :title="row.lastSeenAt ? fmt(row.lastSeenAt) : undefined">
          {{ timeAgo(row.lastSeenAt) ?? "-" }}
        </span>
      </template>

      <template #expiresAt="{ row }">
        <span class="text-muted">{{ fmt(row.revokedAt ?? row.expiresAt) }}</span>
      </template>

      <template #status="{ row }">
        <UBadge v-if="row.revokedAt" color="warning" variant="subtle" size="sm">
          {{ t("profile.sessionsPage.revoked") }}
        </UBadge>
        <UBadge v-else color="neutral" variant="subtle" size="sm">{{ t("profile.sessionsPage.expired") }}</UBadge>
      </template>
    </DataTable>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="t('accounts.allSessions.detail.purgeConfirmTitle', { account: accountLabel })"
      :description="t('accounts.allSessions.detail.purgeConfirmDescription')"
      @confirm="purge"
    />
  </div>
</template>
