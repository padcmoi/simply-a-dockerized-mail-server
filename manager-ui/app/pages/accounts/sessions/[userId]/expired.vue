<script setup lang="ts">
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
const { set: setBreadcrumb } = useBreadcrumb();

const account = ref<AccountSummary | null>(null);

const userId = computed(() => route.params.userId as string);
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
} = usePaginatedList<Session>(
  `account-sessions-history-${userId.value}`,
  `/accounts/${userId.value}/sessions/history`,
  "createdAt"
);

const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

const SORTABLE_COLUMNS = computed(() => [
  { key: "createdAt", label: t("profile.sessionsPage.colSignedIn") },
  { key: "expiresAt", label: t("profile.sessionsPage.colEnded") },
]);

const columns = computed(() => [
  { id: "device", header: t("profile.sessionsPage.colDevice") },
  { id: "ip", header: t("profile.sessionsPage.colIp") },
  { accessorKey: "createdAt", header: header("createdAt", t("profile.sessionsPage.colSignedIn")) },
  { accessorKey: "expiresAt", header: header("expiresAt", t("profile.sessionsPage.colEnded")) },
  { id: "status", header: t("profile.sessionsPage.colStatus") },
]);

watch(
  accountLabel,
  (label) => {
    setBreadcrumb([
      { label: t("nav.accounts"), to: "/accounts" },
      { label: t("accounts.allSessions.label"), to: "/accounts/sessions" },
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

onMounted(loadAccount);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/accounts/sessions" size="sm">
      {{ t("accounts.allSessions.label") }}
    </UButton>

    <h2 class="font-semibold">{{ t("accounts.allSessions.detail.expiredTitle", { account: accountLabel }) }}</h2>

    <ListToolbar
      v-model:search="search"
      v-model:limit="limit"
      v-model:sort-by="sortBy"
      v-model:sort-dir="sortDir"
      :total="total"
      :sortable-columns="SORTABLE_COLUMNS"
    />

    <ListSkeleton v-if="!historyLoaded" :columns="5" />

    <template v-else-if="total === 0">
      <UEmptyState icon="i-lucide-history" :title="t('accounts.allSessions.expiredEmpty')" />
    </template>

    <template v-else>
      <UCard class="hidden xl:block">
        <UTable :loading="historyLoading" :data="history" :columns="columns" sticky>
          <template #device-cell="{ row }">
            <div class="flex items-center gap-2">
              <UIcon :name="deviceIcon(row.original.userAgent)" class="text-muted shrink-0" />
              <span class="truncate" :title="row.original.userAgent ?? undefined">{{ deviceLabel(row.original.userAgent) }}</span>
            </div>
          </template>
          <template #ip-cell="{ row }">
            <span class="text-muted">{{ row.original.ip || t("profile.sessionsPage.unknownIp") }}</span>
          </template>
          <template #createdAt-cell="{ row }">
            <span class="text-muted">{{ fmt(row.original.createdAt) }}</span>
          </template>
          <template #expiresAt-cell="{ row }">
            <span class="text-muted">{{ fmt(row.original.revokedAt ?? row.original.expiresAt) }}</span>
          </template>
          <template #status-cell="{ row }">
            <UBadge v-if="row.original.revokedAt" color="warning" variant="subtle" size="sm">
              {{ t("profile.sessionsPage.revoked") }}
            </UBadge>
            <UBadge v-else color="neutral" variant="subtle" size="sm">{{ t("profile.sessionsPage.expired") }}</UBadge>
          </template>
        </UTable>
      </UCard>

      <div class="xl:hidden space-y-3">
        <p v-if="history.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <UCard v-for="s in history" v-else :key="s.id" :ui="{ body: 'p-3 sm:p-3' }">
          <div class="flex items-start gap-3">
            <div class="rounded-md p-2 bg-elevated shrink-0">
              <UIcon :name="deviceIcon(s.userAgent)" class="text-muted" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <p class="font-medium truncate">{{ deviceLabel(s.userAgent) }}</p>
                <UBadge v-if="s.revokedAt" color="warning" variant="subtle" size="xs" class="shrink-0">
                  {{ t("profile.sessionsPage.revoked") }}
                </UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="xs" class="shrink-0">
                  {{ t("profile.sessionsPage.expired") }}
                </UBadge>
              </div>
              <p class="text-xs text-muted truncate">{{ s.ip || t("profile.sessionsPage.unknownIp") }}</p>
              <p class="text-xs text-muted truncate">{{ t("profile.sessionsPage.signedIn") }} {{ fmt(s.createdAt) }}</p>
            </div>
          </div>
        </UCard>
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>
  </div>
</template>
