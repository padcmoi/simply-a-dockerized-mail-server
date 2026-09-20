<script setup lang="ts">
// The three signature files, read from their own headers: what they hold, when
// ClamAV built them, and how far each one is from the version published right
// now. A database with no published version to compare against is shown as it
// is, never as up to date.
const { databases } = defineProps<{ databases: ClamavDatabase[] }>();

const { t, locale } = useI18n();

const tag = computed(() => locale.value.replace(/_/g, "-"));

const LABELS: Record<string, string> = {
  main: "clamav.databases.main",
  daily: "clamav.databases.daily",
  bytecode: "clamav.databases.bytecode",
};

const rows = computed(() =>
  databases.map((database) => ({
    ...database,
    label: LABELS[database.name] ? t(LABELS[database.name] as string) : database.name,
    builtLabel:
      database.builtAt === null
        ? null
        : new Date(database.builtAt).toLocaleString(tag.value, { dateStyle: "short", timeStyle: "short" }),
    signaturesLabel: database.signatures === null ? null : database.signatures.toLocaleString(tag.value),
    sizeLabel: database.bytes === null ? null : formatBytes(database.bytes),
  }))
);
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="flex items-center gap-2 font-semibold">
        <UIcon name="i-lucide-database" class="size-4 text-primary" />
        {{ t("clamav.databases.title") }}
      </h2>
    </template>

    <p v-if="!rows.length" class="text-sm text-muted">{{ t("clamav.databases.none") }}</p>

    <!-- Laid out as a row of boxes rather than a table: the stylesheet zeroes
         the padding of every cell of the app's tables, and a row of figures
         with nothing between its columns is a row that cannot be read. -->
    <div v-else class="overflow-x-auto">
      <div class="min-w-3xl">
        <div class="flex items-center gap-6 border-b border-default pb-2 text-xs text-muted">
          <span class="w-56 shrink-0">{{ t("clamav.databases.name") }}</span>
          <span class="w-20 shrink-0">{{ t("clamav.databases.version") }}</span>
          <span class="w-20 shrink-0">{{ t("clamav.databases.published") }}</span>
          <span class="w-36 shrink-0">{{ t("clamav.databases.built") }}</span>
          <span class="flex-1 text-right">{{ t("clamav.databases.signatures") }}</span>
          <span class="w-24 shrink-0 text-right">{{ t("clamav.databases.size") }}</span>
          <span class="w-32 shrink-0">{{ t("clamav.databases.state") }}</span>
        </div>

        <div
          v-for="row in rows"
          :key="row.name"
          class="flex items-center gap-6 border-b border-default py-2.5 text-sm last:border-0"
        >
          <span class="flex w-56 shrink-0 items-baseline gap-2">
            <span class="font-medium">{{ row.label }}</span>
            <span class="font-mono text-xs text-dimmed">{{ row.file }}</span>
          </span>
          <span class="w-20 shrink-0 font-mono">{{ row.version ?? t("clamav.databases.unknown") }}</span>
          <span class="w-20 shrink-0 font-mono text-muted">{{ row.published ?? t("clamav.databases.unknown") }}</span>
          <span class="w-36 shrink-0 text-muted">{{ row.builtLabel ?? t("clamav.databases.unknown") }}</span>
          <span class="flex-1 text-right tabular-nums">{{ row.signaturesLabel ?? "-" }}</span>
          <span class="w-24 shrink-0 text-right tabular-nums text-muted">{{ row.sizeLabel ?? "-" }}</span>
          <span class="w-32 shrink-0">
            <UBadge v-if="row.behind === null" color="neutral" variant="subtle" size="xs">
              {{ t("clamav.databases.unknown") }}
            </UBadge>
            <UBadge v-else-if="row.behind === 0" color="success" variant="subtle" size="xs" icon="i-lucide-check">
              {{ t("clamav.databases.current") }}
            </UBadge>
            <UBadge v-else color="warning" variant="subtle" size="xs" icon="i-lucide-triangle-alert">
              {{ t("clamav.databases.behind", row.behind) }}
            </UBadge>
          </span>
        </div>
      </div>
    </div>
  </UCard>
</template>
