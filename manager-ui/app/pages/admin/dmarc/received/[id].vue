<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "dmarc", action: "access" },
    { resource: "dmarc", action: "view-dmarc-reports" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();
const { download } = useDmarcActions();
const { period, count } = useDmarcFormat();

const id = computed(() => Number(route.params.id));

const { data: report, status } = useAsyncData(
  `dmarc-report-${id.value}`,
  () => call<DmarcIncomingDetail>(`/dmarc/incoming/${id.value}`),
  {
    server: false,
    watch: [id],
  }
);

const facts = computed(() => {
  const r = report.value;
  if (!r) return [];
  return [
    { label: t("dmarc.report.period"), value: period(r.periodBegin, r.periodEnd) },
    {
      label: t("dmarc.report.policy"),
      value: t("dmarc.report.policyValue", { p: r.p, sp: r.sp, adkim: r.adkim, aspf: r.aspf, pct: r.pct }),
    },
    { label: t("dmarc.report.messages"), value: count(r.messages) },
  ];
});

watch(
  report,
  (value) => {
    setBreadcrumb([
      { label: t("nav.dmarc"), to: "/admin/dmarc" },
      { label: t("dmarc.sections.received"), to: "/admin/dmarc/received" },
      { label: value ? `${value.orgName} · ${value.domain}` : String(id.value) },
    ]);
  },
  { immediate: true }
);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <DmarcSections active="received" />

    <UAlert
      v-if="status === 'error'"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('dmarc.report.notFound')"
    />

    <div v-else-if="!report" class="space-y-4">
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <template v-else>
      <UCard>
        <div class="flex flex-col lg:flex-row lg:items-start gap-4">
          <div class="min-w-0 flex-1 space-y-1">
            <h1 class="text-lg font-semibold">{{ report.domain }}</h1>
            <p class="text-sm text-muted">{{ t("dmarc.report.sentBy", { org: report.orgName }) }} · {{ report.orgEmail }}</p>
            <p class="text-xs text-dimmed font-mono">{{ report.reportId }}</p>
          </div>
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="subtle"
            :label="t('dmarc.report.download')"
            @click="download('incoming', report.id)"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mt-6">
          <div v-for="fact in facts" :key="fact.label" class="min-w-0">
            <p class="text-xs text-muted">{{ fact.label }}</p>
            <p class="text-sm font-medium break-words">{{ fact.value }}</p>
          </div>
          <div>
            <p class="text-xs text-muted">{{ t("dmarc.report.pass") }}</p>
            <DmarcRate :part="report.dmarcPass" :whole="report.messages" />
          </div>
          <div>
            <p class="text-xs text-muted">{{ t("dmarc.report.dkim") }}</p>
            <DmarcRate :part="report.dkimPass" :whole="report.messages" />
          </div>
          <div>
            <p class="text-xs text-muted">{{ t("dmarc.report.spf") }}</p>
            <DmarcRate :part="report.spfPass" :whole="report.messages" />
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("dmarc.report.rowsTitle") }}</h2>
        </template>
        <DmarcReportRows :rows="report.rows" />
      </UCard>
    </template>
  </div>
</template>
