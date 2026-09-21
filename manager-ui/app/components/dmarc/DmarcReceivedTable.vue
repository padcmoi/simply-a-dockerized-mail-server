<script setup lang="ts">
const page = defineModel<number>("page", { default: 1 });
const limit = defineModel<number>("pageSize", { default: 10 });
const search = defineModel<string>("search", { default: "" });
const searchBy = defineModel<string>("searchBy", { default: ALL_COLUMNS });
const sortKey = defineModel<string>("sortKey", { default: "" });
const sortDirection = defineModel<"asc" | "desc">("sortDirection", { default: "desc" });
const domain = defineModel<string>("domain", { default: "" });

defineProps<{
  rows: DmarcIncomingReport[];
  total: number;
  loading: boolean;
  domains: string[];
}>();

const { t } = useI18n();
const { formatDateTime } = useDateTime();
const { period, count } = useDmarcFormat();

const columns = computed<DataTableColumn<DmarcIncomingReport>[]>(() => [
  { key: "periodBegin", label: t("dmarc.received.col.period"), value: (row) => row.periodBegin, searchable: false },
  { key: "orgName", label: t("dmarc.received.col.org"), value: (row) => row.orgName, primary: true },
  { key: "domain", label: t("dmarc.received.col.domain"), value: (row) => row.domain },
  { key: "messages", label: t("dmarc.received.col.messages"), value: (row) => row.messages, searchable: false },
  { key: "dmarcPass", label: t("dmarc.received.col.pass"), value: (row) => row.dmarcPass, searchable: false },
  { key: "receivedAt", label: t("dmarc.received.col.received"), value: (row) => row.receivedAt, searchable: false },
]);
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
    :row-key="(row: DmarcIncomingReport) => row.id"
    :empty-label="t('dmarc.received.empty')"
  >
    <template #filters>
      <DmarcDomainFilter v-model="domain" :domains="domains" />
    </template>

    <template #periodBegin="{ row }">
      <span class="whitespace-nowrap">{{ period(row.periodBegin, row.periodEnd) }}</span>
    </template>

    <template #orgName="{ row }">
      <NuxtLink :to="`/admin/dmarc/received/${row.id}`" class="font-medium text-primary hover:underline">{{
        row.orgName
      }}</NuxtLink>
    </template>

    <template #messages="{ row }">{{ count(row.messages) }}</template>

    <template #dmarcPass="{ row }"><DmarcRate :part="row.dmarcPass" :whole="row.messages" /></template>

    <template #receivedAt="{ row }">
      <span class="text-muted whitespace-nowrap">{{ formatDateTime(row.receivedAt) }}</span>
    </template>
  </DataTable>
</template>
