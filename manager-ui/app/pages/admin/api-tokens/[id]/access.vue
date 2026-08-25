<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";

definePageMeta({
  requiredGlobal: [
    { resource: "api-tokens", action: "access" },
    { resource: "api-tokens", action: "list-api-tokens" },
  ],
});

interface AccessEntry {
  id: string;
  method: string;
  route: string;
  statusCode: number;
  clientIp: string;
  country: string;
  userAgent: string;
  origin: string;
  referer: string;
  durationMs: number;
  createdAt: string;
}

const route = useRoute();
const { t, locale } = useI18n();
const { formatDateTime } = useDateTime();
const { set: setBreadcrumb } = useBreadcrumb();

const tokenId = computed(() => route.params.id as string);
const { tokens, loading: tokensLoading } = useApiTokens();
const token = computed(() => tokens.value.find((item) => String(item.id) === tokenId.value) ?? null);
const tokenLabel = computed(() => token.value?.name ?? t("apiTokens.access.title"));

const {
  items: entries,
  total,
  loading,
  hasLoadedOnce,
  page,
  limit,
  search,
  sortBy,
  sortDir,
} = usePaginatedList<AccessEntry>(`api-token-access-${tokenId.value}`, `/api-tokens/${tokenId.value}/access`, "createdAt");

const columns = computed<DataTableColumn<AccessEntry>[]>(() => [
  { key: "createdAt", label: t("apiTokens.access.colWhen"), value: (row) => row.createdAt, primary: true },
  { key: "method", label: t("apiTokens.access.colMethod"), value: (row) => row.method },
  { key: "route", label: t("apiTokens.access.colRoute"), value: (row) => row.route },
  { key: "statusCode", label: t("apiTokens.access.colStatus"), value: (row) => row.statusCode },
  { key: "clientIp", label: t("apiTokens.access.colFrom"), value: (row) => row.clientIp },
  { key: "origin", label: t("apiTokens.access.colOrigin"), value: (row) => row.origin || row.referer, sortable: false },
  { key: "userAgent", label: t("apiTokens.access.colAgent"), value: (row) => row.userAgent, sortable: false },
  { key: "durationMs", label: t("apiTokens.access.colDuration"), value: (row) => row.durationMs },
]);

watch(
  tokenLabel,
  (label) => {
    setBreadcrumb([{ label: t("nav.apiTokens"), to: "/admin/api-tokens" }, { label }, { label: t("apiTokens.access.crumb") }]);
  },
  { immediate: true }
);

function countryName(code: string) {
  if (!code) return undefined;
  try {
    return new Intl.DisplayNames([locale.value.replace(/_/g, "-")], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function agentLabel(userAgent: string) {
  if (!userAgent) return "-";
  const parsed = parseUserAgent(userAgent);
  if (parsed.browser && parsed.os) return t("profile.sessionsPage.deviceOn", { browser: parsed.browser, os: parsed.os });
  return userAgent;
}

function agentIcon(userAgent: string) {
  const parsed = parseUserAgent(userAgent);
  return parsed.browser ? parsed.icon : "i-lucide-terminal";
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-history"
      :title="tokenLabel"
      :description="t('apiTokens.access.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <div class="flex items-center justify-between gap-3">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/api-tokens" size="sm">
        {{ t("apiTokens.access.backToList") }}
      </UButton>
      <USkeleton v-if="tokensLoading && !token" class="h-5 w-64" />
      <span v-else-if="token" class="font-mono text-xs text-muted truncate min-w-0">{{ token.clientId }}</span>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="6" />

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      :data="entries"
      :columns="columns"
      :total="total"
      :loading="loading"
      :row-key="(row: AccessEntry) => row.id"
      :empty-label="t('apiTokens.access.empty')"
    >
      <template #createdAt="{ row }">
        <span class="whitespace-nowrap text-muted">{{ formatDateTime(row.createdAt) }}</span>
      </template>

      <template #method="{ row }">
        <UBadge :color="methodColor(row.method)" variant="subtle" size="sm" class="font-mono">{{ row.method }}</UBadge>
      </template>

      <template #route="{ row }">
        <TruncatedText :text="row.route" :limit="60" text-class="font-mono text-xs" />
      </template>

      <template #statusCode="{ row }">
        <UBadge :color="statusColor(row.statusCode)" variant="subtle" size="sm">{{ row.statusCode }}</UBadge>
      </template>

      <template #clientIp="{ row }">
        <span class="flex items-center gap-1.5 min-w-0" :title="countryName(row.country)">
          <span v-if="row.country" class="shrink-0">{{ countryFlagEmoji(row.country) }}</span>
          <span class="font-mono text-xs truncate">{{ row.clientIp || "-" }}</span>
        </span>
      </template>

      <template #origin="{ row }">
        <TruncatedText :text="row.origin || row.referer || '-'" :limit="32" text-class="text-xs" />
      </template>

      <template #userAgent="{ row }">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon v-if="row.userAgent" :name="agentIcon(row.userAgent)" class="size-4 shrink-0 text-dimmed" />
          <TruncatedText :text="agentLabel(row.userAgent)" :limit="32" text-class="text-xs" />
        </div>
      </template>

      <template #durationMs="{ row }">
        <span class="whitespace-nowrap text-muted">{{ row.durationMs }} ms</span>
      </template>
    </DataTable>
  </div>
</template>
