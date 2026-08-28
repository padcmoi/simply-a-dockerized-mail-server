<script setup lang="ts">
import type { CheckSection, DeliverabilityReport } from "~/composables/useDeliverability";

definePageMeta({
  requiredGlobal: [
    { resource: "deliverability", action: "access" },
    { resource: "deliverability", action: "run-diagnostics" },
  ],
  requiredDomain: [{ resource: "domain", action: "access" }],
});

const { t } = useI18n();
const toast = useToast();
const { formatDateTime } = useDateTime();
const { set: setBreadcrumb } = useBreadcrumb();
const { domainId, domainFqdn } = useCurrentDomain();
const { apiErrorMessage } = useApiError();
const { run } = useDeliverability(() => domainId.value);

const report = ref<DeliverabilityReport | null>(null);
const running = ref(false);
const failed = ref(false);

const bySection = computed(() => {
  const groups = {} as Record<CheckSection, DeliverabilityReport["checks"]>;
  for (const section of DELIVERABILITY_SECTIONS) {
    groups[section] = report.value?.checks.filter((c) => c.section === section) ?? [];
  }
  return groups;
});

const exportItems = computed(() => [
  [
    { label: t("deliverability.exportText"), icon: "i-lucide-file-text", onSelect: () => saveReport("txt") },
    { label: t("deliverability.exportJson"), icon: "i-lucide-file-json", onSelect: () => saveReport("json") },
  ],
]);

const verdict = computed(() => {
  const counts = report.value?.counts;
  if (!counts) return null;
  if (counts.fail > 0) return "fail" as const;
  if (counts.warn > 0) return "warn" as const;
  return "pass" as const;
});

watch(
  domainFqdn,
  (fqdn) => {
    if (!fqdn) return;
    setBreadcrumb([
      { label: t("nav.domains"), to: "/admin/domains" },
      { label: fqdn, to: `/admin/domains/${fqdn}` },
      { label: t("nav.deliverability") },
    ]);
  },
  { immediate: true }
);

// The file is built here from the report already on screen: nothing is sent
// anywhere to produce it, and what it holds is exactly what is displayed.
function saveReport(format: "txt" | "json") {
  const current = report.value;
  if (!current) return;
  const translated = (prefix: string) => (id: string) => {
    const key = `deliverability.${prefix}.${id}`;
    const text = t(key);
    return text === key ? null : text;
  };
  const content =
    format === "json"
      ? reportAsJson(current)
      : reportAsText(current, {
          title: t("deliverability.title"),
          checkedAt: t("deliverability.checkedAt", { at: formatDateTime(current.checkedAt) }),
          sections: Object.fromEntries(DELIVERABILITY_SECTIONS.map((s) => [s, t(`deliverability.sections.${s}`)])),
          status: Object.fromEntries(
            (["pass", "warn", "fail", "skip"] as const).map((s) => [s, t(`deliverability.status.${s}`)])
          ),
          label: (id: string) => translated("checks")(id) ?? id,
          hint: translated("hints"),
        });
  downloadReport(
    content,
    reportFilename(current.domain, current.checkedAt, format),
    format === "json" ? "application/json" : "text/plain"
  );
}

// Every check is a live network probe, so it runs on demand and on arrival,
// never on a timer: DNS, an SMTP session and a handful of blocklists is not
// something to fire on every render.
async function execute() {
  if (!domainId.value) return;
  running.value = true;
  failed.value = false;
  try {
    report.value = await run();
  } catch (e) {
    failed.value = true;
    toast.add({ title: t("deliverability.failed"), description: apiErrorMessage(e), color: "error" });
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-mail-check"
      :title="t('deliverability.title')"
      :description="t('deliverability.description')"
    />

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <h2 class="font-semibold text-lg">{{ domainFqdn }}</h2>
        <UBadge v-if="report?.mailIp" color="neutral" variant="subtle" class="font-mono text-xs">
          {{ report.mxHost }} · {{ report.mailIp }}
        </UBadge>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="report" class="text-xs text-muted">{{
          t("deliverability.checkedAt", { at: formatDateTime(report.checkedAt) })
        }}</span>
        <UDropdownMenu v-if="report" :items="exportItems">
          <UButton icon="i-lucide-download" color="neutral" variant="subtle" trailing-icon="i-lucide-chevron-down">
            {{ t("deliverability.export") }}
          </UButton>
        </UDropdownMenu>
        <UButton icon="i-lucide-refresh-cw" color="primary" :loading="running" @click="execute">
          {{ report ? t("deliverability.rerun") : t("deliverability.run") }}
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="verdict === 'pass'"
      color="success"
      variant="subtle"
      icon="i-lucide-check-check"
      :title="t('deliverability.verdict.passTitle')"
      :description="t('deliverability.verdict.passHint')"
    />
    <UAlert
      v-else-if="verdict === 'warn'"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('deliverability.verdict.warnTitle')"
      :description="t('deliverability.verdict.warnHint')"
    />
    <UAlert
      v-else-if="verdict === 'fail'"
      color="error"
      variant="subtle"
      icon="i-lucide-octagon-alert"
      :title="t('deliverability.verdict.failTitle')"
      :description="t('deliverability.verdict.failHint')"
    />

    <div v-if="report" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <UCard v-for="status in ['pass', 'warn', 'fail', 'skip'] as const" :key="status" :ui="{ body: 'p-3 sm:p-3' }">
        <p class="text-xs text-muted">{{ t(`deliverability.status.${status}`) }}</p>
        <p class="text-2xl font-semibold tabular-nums" :class="`text-${STATUS_COLOR[status]}`">{{ report.counts[status] }}</p>
      </UCard>
    </div>

    <UCard v-if="!report && !running" :ui="{ body: 'p-8 sm:p-8' }">
      <div class="flex flex-col items-center gap-3 text-center">
        <UIcon name="i-lucide-radar" class="size-8 text-dimmed" />
        <p class="text-sm text-muted max-w-prose">{{ t("deliverability.idle") }}</p>
        <UButton icon="i-lucide-play" color="primary" @click="execute">{{ t("deliverability.run") }}</UButton>
      </div>
    </UCard>

    <ListSkeleton v-else-if="running && !report" :columns="4" />

    <UAlert
      v-else-if="failed && !report"
      color="error"
      variant="subtle"
      icon="i-lucide-unplug"
      :title="t('deliverability.failed')"
    />

    <div v-else-if="report" class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <DeliverabilitySection
        v-for="section in DELIVERABILITY_SECTIONS"
        :key="section"
        :section="section"
        :checks="bySection[section]"
      />
    </div>

    <UAlert color="neutral" variant="subtle" icon="i-lucide-book-open" :title="t('deliverability.docTitle')">
      <template #description>
        <p>{{ t("deliverability.docHint") }}</p>
      </template>
    </UAlert>
  </div>
</template>
