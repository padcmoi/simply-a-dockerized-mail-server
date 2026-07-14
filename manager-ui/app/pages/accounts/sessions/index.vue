<script setup lang="ts">
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
}

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.accounts"), to: "/accounts" }, { label: t("accounts.allSessions.label") }]);

const overview = ref<AccountSessionSummary[]>([]);
const loading = ref(false);
const loaded = ref(false);

// Expired section is a table like /profile/sessions: searchable, sortable and
// paginated, collapsing to cards under `xl`. The overview is a single fetch of
// every account, so search/sort/paginate happen client-side over that list.
const expiredSearch = ref("");
const expiredSortBy = ref("expiredCount");
const expiredSortDir = ref<"asc" | "desc">("desc");
const expiredPage = ref(1);
const expiredLimit = ref(10);

const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(expiredSortBy, expiredSortDir, UButton);

const activeAccounts = computed(() => overview.value.filter((a) => a.activeCount > 0));
const expiredAccounts = computed(() => overview.value.filter((a) => a.expiredCount > 0));

const EXPIRED_SORTABLE = computed(() => [
  { key: "email", label: t("accounts.allSessions.colAccount") },
  { key: "expiredCount", label: t("accounts.allSessions.colExpired") },
]);

const expiredColumns = computed(() => [
  { id: "account", header: header("email", t("accounts.allSessions.colAccount")) },
  { accessorKey: "expiredCount", header: header("expiredCount", t("accounts.allSessions.colExpired")) },
  { id: "actions", header: "" },
]);

const expiredFiltered = computed(() => {
  const q = expiredSearch.value.trim().toLowerCase();
  const rows = q
    ? expiredAccounts.value.filter(
        (a) => (a.email ?? "").toLowerCase().includes(q) || (a.displayName ?? "").toLowerCase().includes(q)
      )
    : expiredAccounts.value;
  const dir = expiredSortDir.value === "asc" ? 1 : -1;
  return [...rows].sort((a, b) =>
    expiredSortBy.value === "email" ? dir * (a.email ?? "").localeCompare(b.email ?? "") : dir * (a.expiredCount - b.expiredCount)
  );
});
const expiredTotal = computed(() => expiredFiltered.value.length);
const expiredPaged = computed(() => {
  const start = (expiredPage.value - 1) * expiredLimit.value;
  return expiredFiltered.value.slice(start, start + expiredLimit.value);
});

// Reload on the shared refresh tick (header button, focus, heartbeat).
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

function openActive(a: AccountSessionSummary) {
  navigateTo(`/accounts/sessions/${a.accountId}/active`);
}

function openExpired(a: AccountSessionSummary) {
  navigateTo(`/accounts/sessions/${a.accountId}/expired`);
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

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/accounts" size="sm">
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
          <UAvatar :alt="accountLabel(a)" size="sm" class="shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ accountLabel(a) }}</p>
            <p v-if="a.displayName && a.email" class="text-xs text-muted truncate">{{ a.email }}</p>
          </div>
          <UBadge v-if="a.online" color="success" variant="solid" icon="i-lucide-circle" class="shrink-0">
            {{ t("accounts.allSessions.online") }}
          </UBadge>
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

      <ListToolbar
        v-model:search="expiredSearch"
        v-model:limit="expiredLimit"
        v-model:sort-by="expiredSortBy"
        v-model:sort-dir="expiredSortDir"
        :total="expiredTotal"
        :sortable-columns="EXPIRED_SORTABLE"
      />

      <ListSkeleton v-if="!loaded" :columns="3" />

      <template v-else-if="expiredAccounts.length === 0">
        <UEmptyState icon="i-lucide-history" :title="t('accounts.allSessions.expiredEmpty')" />
      </template>

      <template v-else>
        <UCard class="hidden xl:block">
          <UTable :data="expiredPaged" :columns="expiredColumns" sticky>
            <template #account-cell="{ row }">
              <button type="button" class="flex items-center gap-2 text-left group" @click="openExpired(row.original)">
                <UAvatar :alt="accountLabel(row.original)" size="xs" class="shrink-0" />
                <span class="min-w-0">
                  <span class="block font-medium truncate group-hover:text-primary transition-colors">
                    {{ accountLabel(row.original) }}
                  </span>
                  <span v-if="row.original.displayName && row.original.email" class="block text-xs text-muted truncate">
                    {{ row.original.email }}
                  </span>
                </span>
              </button>
            </template>
            <template #expiredCount-cell="{ row }">
              <UBadge color="neutral" variant="subtle" size="sm">
                {{ t("accounts.allSessions.expiredCount", { count: row.original.expiredCount }) }}
              </UBadge>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-arrow-right"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :title="t('accounts.allSessions.viewDetails')"
                  @click="openExpired(row.original)"
                />
              </div>
            </template>
          </UTable>
        </UCard>

        <div class="xl:hidden space-y-3">
          <p v-if="expiredPaged.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
          <UCard
            v-for="a in expiredPaged"
            v-else
            :key="a.accountId"
            :ui="{ body: 'p-3 sm:p-3' }"
            class="cursor-pointer"
            @click="openExpired(a)"
          >
            <div class="flex items-center gap-3">
              <UAvatar :alt="accountLabel(a)" size="sm" class="shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="font-medium truncate">{{ accountLabel(a) }}</p>
                <p v-if="a.displayName && a.email" class="text-xs text-muted truncate">{{ a.email }}</p>
              </div>
              <UBadge color="neutral" variant="subtle" size="sm" class="shrink-0">
                {{ t("accounts.allSessions.expiredCount", { count: a.expiredCount }) }}
              </UBadge>
              <UIcon name="i-lucide-arrow-right" class="text-muted shrink-0" />
            </div>
          </UCard>
        </div>

        <ListPagination v-model:page="expiredPage" :total="expiredTotal" :limit="expiredLimit" />
      </template>
    </div>
  </div>
</template>
