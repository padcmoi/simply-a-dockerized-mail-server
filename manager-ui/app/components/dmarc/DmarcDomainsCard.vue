<script setup lang="ts">
const { domains } = defineProps<{ domains: DmarcDomainSummary[] }>();

const { t } = useI18n();
const { count } = useDmarcFormat();

const columns = computed<DataTableColumn<DmarcDomainSummary>[]>(() => [
  { key: "domain", label: t("dmarc.overview.col.domain"), value: (row) => row.domain, primary: true },
  { key: "reports", label: t("dmarc.overview.col.reports"), value: (row) => row.reports },
  { key: "reporters", label: t("dmarc.overview.col.reporters"), value: (row) => row.reporters },
  { key: "messages", label: t("dmarc.overview.col.messages"), value: (row) => row.messages },
  { key: "dmarcPass", label: t("dmarc.overview.col.pass"), value: (row) => row.dmarcPass },
  { key: "dkimPass", label: t("dmarc.overview.col.dkim"), value: (row) => row.dkimPass },
  { key: "spfPass", label: t("dmarc.overview.col.spf"), value: (row) => row.spfPass },
]);
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t("dmarc.overview.domainsTitle") }}</h2>
    </template>

    <DataTable
      :data="domains"
      :columns="columns"
      :row-key="(row: DmarcDomainSummary) => row.domain"
      :empty-label="t('dmarc.overview.domainsEmpty')"
    >
      <template #domain="{ row }">
        <NuxtLink
          :to="{ path: '/admin/dmarc/received', query: { domain: row.domain } }"
          class="font-medium text-primary hover:underline"
        >
          {{ row.domain }}
        </NuxtLink>
      </template>
      <template #reports="{ row }">{{ count(row.reports) }}</template>
      <template #reporters="{ row }">{{ count(row.reporters) }}</template>
      <template #messages="{ row }">{{ count(row.messages) }}</template>
      <template #dmarcPass="{ row }"><DmarcRate :part="row.dmarcPass" :whole="row.messages" /></template>
      <template #dkimPass="{ row }"><DmarcRate :part="row.dkimPass" :whole="row.messages" /></template>
      <template #spfPass="{ row }"><DmarcRate :part="row.spfPass" :whole="row.messages" /></template>
    </DataTable>
  </UCard>
</template>
