<script setup lang="ts">
// The journal as a table, shared by the account's own page and the server
// page: the same columns, the same filter on one kind of event, the server
// page adding the account each line belongs to. Paged, searched and sorted by
// the API through the models bound here.
const page = defineModel<number>("page", { default: 1 });
const limit = defineModel<number>("pageSize", { default: 10 });
const search = defineModel<string>("search", { default: "" });
const searchBy = defineModel<string>("searchBy", { default: ALL_COLUMNS });
const sortKey = defineModel<string>("sortKey", { default: "" });
const sortDirection = defineModel<"asc" | "desc">("sortDirection", { default: "desc" });
const action = defineModel<string>("action", { default: "" });

const props = defineProps<{
  rows: ActivityRow[];
  total: number;
  loading: boolean;
  actions: string[];
  withAccount?: boolean;
}>();

const { t, locale } = useI18n();
const { formatDateTime } = useDateTime();
const { label, actionLabel, icon } = useActivityLabel();
const { isRoot, hasGlobal } = usePermissions();

const canOpenAccount = computed(() => isRoot.value || (hasGlobal("accounts", "access") && hasGlobal("accounts", "view-account")));

const ALL = "__all__";

const actionItems = computed(() => [
  { label: t("activity.filterAll"), value: ALL },
  ...props.actions.map((value) => ({ label: actionLabel(value), value })),
]);

const actionFilter = computed({
  get: () => action.value || ALL,
  set: (value: string) => {
    action.value = value === ALL ? "" : value;
  },
});

const columns = computed<DataTableColumn<ActivityRow>[]>(() => [
  { key: "createdAt", label: t("activity.col.when"), value: (row) => row.createdAt, searchable: false },
  ...(props.withAccount
    ? [
        {
          key: "actorEmail",
          label: t("activity.col.account"),
          value: (row: ActivityRow) => row.actorEmail ?? "",
        },
      ]
    : []),
  { key: "action", label: t("activity.col.event"), value: (row) => label(row), primary: true },
  { key: "entityLabel", label: t("activity.col.object"), value: (row) => row.entityLabel ?? "", sortable: false },
  {
    key: "device",
    label: t("activity.col.device"),
    value: (row) => deviceLabel(row.userAgent),
    sortable: false,
    searchKey: "userAgent",
  },
  { key: "ip", label: t("activity.col.ip"), value: (row) => row.ip ?? "", sortable: false },
]);

function countryName(code: string) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale.value.split("_")[0] ?? "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function deviceLabel(ua: string | null) {
  const parsed = parseUserAgent(ua);
  if (parsed.browser && parsed.os) return t("activity.deviceOn", { browser: parsed.browser, os: parsed.os });
  return parsed.browser ?? parsed.os ?? t("activity.unknownDevice");
}
</script>

<template>
  <DataTable
    v-model:page="page"
    v-model:page-size="limit"
    v-model:search="search"
    v-model:search-by="searchBy"
    v-model:sort-key="sortKey"
    v-model:sort-direction="sortDirection"
    :data="rows"
    :columns="columns"
    :total="total"
    :loading="loading"
    :row-key="(row: ActivityRow) => row.id"
    :empty-label="t('activity.empty')"
  >
    <template #filters>
      <USelect v-model="actionFilter" :items="actionItems" icon="i-lucide-list-filter" class="w-full @lg:w-64" />
    </template>

    <template #createdAt="{ row }">
      <span class="text-muted whitespace-nowrap">{{ formatDateTime(row.createdAt) }}</span>
    </template>

    <template #actorEmail="{ row }">
      <FullTooltip v-if="row.actorEmail" :text="row.actorEmail">
        <NuxtLink
          v-if="canOpenAccount && row.actorId"
          :to="`/admin/accounts/${row.actorId}`"
          class="font-medium text-primary hover:underline"
        >
          {{ truncateChars(row.actorEmail, 32) }}
        </NuxtLink>
        <span v-else>{{ truncateChars(row.actorEmail, 32) }}</span>
      </FullTooltip>
      <span v-else class="text-dimmed">{{ t("activity.noAccount") }}</span>
    </template>

    <template #action="{ row }">
      <span class="flex items-center gap-2 min-w-0">
        <UIcon :name="icon(row.action)" class="size-4 shrink-0 text-muted" />
        <span class="truncate">{{ label(row) }}</span>
      </span>
    </template>

    <template #entityLabel="{ row }">
      <FullTooltip v-if="row.entityLabel" :text="row.entityLabel">
        <span class="font-mono text-xs">{{ truncateChars(row.entityLabel, 36) }}</span>
      </FullTooltip>
      <span v-else class="text-dimmed">-</span>
    </template>

    <template #device="{ row }">
      <span class="flex items-center gap-2">
        <UIcon :name="parseUserAgent(row.userAgent).icon" class="size-4 text-muted shrink-0" />
        <span class="truncate">{{ deviceLabel(row.userAgent) }}</span>
      </span>
    </template>

    <template #ip="{ row }">
      <span class="flex items-center gap-1.5 min-w-0" :title="countryName(row.country)">
        <CountryFlag v-if="row.country" :code="row.country" class="size-4 shrink-0" />
        <span class="font-mono text-xs">{{ row.ip || "-" }}</span>
      </span>
    </template>
  </DataTable>
</template>
