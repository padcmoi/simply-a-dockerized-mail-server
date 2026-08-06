<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
interface Session {
  id: number;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
  active: boolean;
  // Seen within the last minute: currently in use, not just valid.
  online: boolean;
}

definePageMeta({});

const { t, locale } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("profile.sessionsPage.breadcrumb") }]);

// Active sessions: a small live set (one per device), fetched as a plain array.
const active = ref<Session[]>([]);
const activeLoading = ref(false);
const activeLoaded = ref(false);
const revokingId = ref<number | null>(null);

// Expired/revoked sessions: grows over time (every refresh rotates a token), so
// it is server-paginated + searchable exactly like every other list.
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
  load: loadHistory,
} = usePaginatedList<Session>("sessions-history", "/auth/jwt/me/sessions/history", "createdAt");

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
  { key: "expiresAt", label: t("profile.sessionsPage.colEnded"), value: (row) => row.revokedAt ?? row.expiresAt },
  {
    key: "status",
    label: t("profile.sessionsPage.colStatus"),
    value: (row) => (row.revokedAt ? "revoked" : "expired"),
    sortable: false,
  },
]);

watch(useDataRefresh().tick, () => loadActive());

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

async function loadActive() {
  activeLoading.value = true;
  try {
    active.value = await call<Session[]>("/auth/jwt/me/sessions");
  } catch (e) {
    toast.add({ title: t("profile.sessionsPage.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    activeLoading.value = false;
    activeLoaded.value = true;
  }
}

async function revoke(id: number) {
  revokingId.value = id;
  try {
    await call(`/auth/jwt/me/sessions/${id}`, { method: "DELETE" });
    toast.add({ title: t("profile.sessionsPage.toast.revoked"), color: "success" });
    // The revoked session leaves the active set and joins the history.
    await Promise.all([loadActive(), loadHistory()]);
  } catch (e) {
    toast.add({ title: t("profile.sessionsPage.toast.revokeFailed"), description: (e as Error).message, color: "error" });
  } finally {
    revokingId.value = null;
  }
}

onMounted(loadActive);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-monitor"
      :title="t('profile.sessionsPage.alertTitle')"
      :description="t('profile.sessionsPage.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <!-- Container 1: active sessions (live, one per device) -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("profile.sessionsPage.activeTitle") }}</h2>
      </template>

      <div v-if="activeLoading && !activeLoaded" class="space-y-3 py-1">
        <USkeleton v-for="i in 2" :key="i" class="h-12 w-full" />
      </div>

      <UEmptyState v-else-if="active.length === 0" icon="i-lucide-monitor" :title="t('profile.sessionsPage.activeEmpty')" />

      <ul v-else class="divide-y divide-default">
        <li v-for="s in active" :key="s.id" class="py-3 flex items-center gap-3">
          <div class="rounded-md p-2 bg-elevated shrink-0">
            <UIcon :name="deviceIcon(s.userAgent)" class="text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ deviceLabel(s.userAgent) }}</p>
            <p class="text-xs text-muted truncate">
              {{ s.ip || t("profile.sessionsPage.unknownIp") }} · {{ t("profile.sessionsPage.signedIn") }}
              {{ fmt(s.createdAt) }}
            </p>
          </div>
          <SessionPresence :online="s.online" :last-seen-at="s.lastSeenAt" />
          <UBadge color="success" variant="subtle" class="shrink-0">{{ t("profile.sessionsPage.active") }}</UBadge>
          <UButton
            icon="i-lucide-log-out"
            color="error"
            variant="ghost"
            size="sm"
            :loading="revokingId === s.id"
            :title="t('profile.sessionsPage.revoke')"
            @click="revoke(s.id)"
          />
        </li>
      </ul>
    </UCard>

    <!-- Container 2: expired / revoked sessions (paginated + searchable table) -->
    <div class="space-y-4">
      <h2 class="font-semibold">{{ t("profile.sessionsPage.expiredTitle") }}</h2>

      <ListSkeleton v-if="!historyLoaded" :columns="5" />

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
            <span class="truncate">{{ deviceLabel(row.userAgent) }}</span>
          </div>
        </template>

        <template #ip="{ row }">
          <span class="text-muted">{{ row.ip || t("profile.sessionsPage.unknownIp") }}</span>
        </template>

        <template #createdAt="{ row }">
          <span class="text-muted">{{ fmt(row.createdAt) }}</span>
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
    </div>
  </div>
</template>
