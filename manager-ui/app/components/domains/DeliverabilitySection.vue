<script setup lang="ts">
const props = defineProps<{ section: CheckSection; checks: DeliverabilityCheck[] }>();

const { t } = useI18n();

const ICONS: Record<CheckSection, string> = {
  identity: "i-lucide-fingerprint",
  dns: "i-lucide-globe",
  server: "i-lucide-server",
  reputation: "i-lucide-gauge",
};

// A check that is neither passing nor skipped is what the reader came for, so
// the section says how many of those it holds before it is even opened.
const attention = computed(() => props.checks.filter((c) => c.status === "fail" || c.status === "warn").length);

// The hint only exists for checks that can be acted on, and only matters when
// they are not green: the i18n file is the single place that decides which.
function hintOf(check: DeliverabilityCheck) {
  if (check.status === "pass") return null;
  const key = `deliverability.hints.${check.id}`;
  const text = t(key, check.params ?? {});
  return text === key ? null : text;
}

// The way out that is easy to miss: a check often has a second, cheaper answer
// than the obvious one, and buried at the end of a paragraph nobody reads it.
// It carries the accent colour for that reason, and only where it exists.
function alternativeOf(check: DeliverabilityCheck) {
  if (check.status === "pass") return null;
  const key = `deliverability.alternatives.${check.id}`;
  const text = t(key, check.params ?? {});
  return text === key ? null : text;
}

function labelOf(check: DeliverabilityCheck) {
  const key = `deliverability.checks.${check.id}`;
  const text = t(key, check.params ?? {});
  return text === key ? check.id : text;
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon :name="ICONS[section]" class="size-4 text-dimmed shrink-0" />
        <h3 class="font-semibold text-sm">{{ t(`deliverability.sections.${section}`) }}</h3>
        <UBadge v-if="attention > 0" color="warning" variant="subtle" size="sm">{{ attention }}</UBadge>
        <UBadge v-else color="success" variant="subtle" size="sm" icon="i-lucide-check" />
      </div>
    </template>

    <ul class="divide-y divide-default -my-2">
      <li v-for="check in checks" :key="check.id" class="py-2.5 flex items-start gap-3 min-w-0">
        <UIcon
          :name="STATUS_ICON[check.status]"
          class="size-4 mt-0.5 shrink-0"
          :class="{
            'text-success': check.status === 'pass',
            'text-warning': check.status === 'warn',
            'text-error': check.status === 'fail',
          }"
        />
        <div class="min-w-0 flex-1 space-y-0.5">
          <p class="text-sm text-default">{{ labelOf(check) }}</p>
          <p v-if="check.evidence" class="font-mono text-xs text-muted break-all">{{ check.evidence }}</p>
          <p v-if="hintOf(check)" class="text-xs text-toned">{{ hintOf(check) }}</p>
          <p v-if="alternativeOf(check)" class="text-xs text-primary">{{ alternativeOf(check) }}</p>
        </div>
        <UBadge :color="STATUS_COLOR[check.status]" variant="subtle" size="sm" class="shrink-0">
          {{ t(`deliverability.status.${check.status}`) }}
        </UBadge>
      </li>
    </ul>
  </UCard>
</template>
