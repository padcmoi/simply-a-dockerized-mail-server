<script setup lang="ts">
const { rows } = defineProps<{ rows: DmarcIncomingRow[] }>();

const { t, te } = useI18n();
const { count } = useDmarcFormat();

const columns = computed<DataTableColumn<DmarcIncomingRow>[]>(() => [
  { key: "sourceIp", label: t("dmarc.report.col.ip"), value: (row) => row.sourceIp, primary: true },
  { key: "count", label: t("dmarc.report.col.count"), value: (row) => row.count, searchable: false },
  { key: "disposition", label: t("dmarc.report.col.disposition"), value: (row) => row.disposition },
  { key: "dkim", label: t("dmarc.report.col.dkim"), value: (row) => row.dkim },
  { key: "spf", label: t("dmarc.report.col.spf"), value: (row) => row.spf },
  { key: "headerFrom", label: t("dmarc.report.col.from"), value: (row) => row.headerFrom },
  { key: "envelopeFrom", label: t("dmarc.report.col.envelope"), value: (row) => row.envelopeFrom ?? "" },
  { key: "auth", label: t("dmarc.report.col.auth"), value: (row) => authLine(row), sortable: false },
]);

function authLine(row: DmarcIncomingRow) {
  const dkim = row.dkimResults.map((d) => `dkim=${d.result} (${d.domain}${d.selector ? `/${d.selector}` : ""})`);
  const spf = row.spfResults.map((s) => `spf=${s.result} (${s.domain})`);
  return [...dkim, ...spf].join(", ");
}

function label(group: "verdict" | "disposition", value: string) {
  const key = `dmarc.${group}.${value}`;
  return te(key) ? t(key) : value;
}
</script>

<template>
  <DataTable
    :data="rows"
    :columns="columns"
    :row-key="(row: DmarcIncomingRow) => row.id"
    :empty-label="t('dmarc.received.empty')"
  >
    <template #sourceIp="{ row }">
      <span class="font-mono text-xs">{{ row.sourceIp }}</span>
    </template>
    <template #count="{ row }">{{ count(row.count) }}</template>
    <template #disposition="{ row }">
      <UBadge :color="row.disposition === 'none' ? 'neutral' : 'warning'" variant="subtle" size="sm">
        {{ label("disposition", row.disposition) }}
      </UBadge>
    </template>
    <template #dkim="{ row }">
      <UBadge :color="row.dkim === 'pass' ? 'success' : 'error'" variant="subtle" size="sm">{{
        label("verdict", row.dkim)
      }}</UBadge>
    </template>
    <template #spf="{ row }">
      <UBadge :color="row.spf === 'pass' ? 'success' : 'error'" variant="subtle" size="sm">{{
        label("verdict", row.spf)
      }}</UBadge>
    </template>
    <template #envelopeFrom="{ row }">
      <span v-if="row.envelopeFrom">{{ row.envelopeFrom }}</span>
      <span v-else class="text-dimmed">-</span>
    </template>
    <template #auth="{ row }">
      <FullTooltip :text="authLine(row)">
        <span class="font-mono text-xs">{{ truncateChars(authLine(row), 48) }}</span>
      </FullTooltip>
    </template>
  </DataTable>
</template>
