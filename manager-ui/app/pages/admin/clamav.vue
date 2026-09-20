<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "clamav", action: "access" },
    { resource: "clamav", action: "view-clamav-status" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const { isRoot, hasGlobal } = usePermissions();

setBreadcrumb([{ label: t("nav.clamav") }]);

const { status, loading, failed, busy, update, reload } = useClamav();

// Each action has a right of its own: asking the scanner to download is a
// minutes-long call out of the installation, rereading the files it already has
// is neither.
const canUpdate = computed(() => isRoot.value || hasGlobal("clamav", "update-signatures"));
const canReload = computed(() => isRoot.value || hasGlobal("clamav", "reload-database"));
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-bug" :title="t('clamav.title')" :description="t('clamav.subtitle')" />

    <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('clamav.loadFailed')" />

    <!-- The shape of what is coming rather than a row of dashes: nothing here
         can be told apart from a scanner that answered zero. -->
    <template v-else-if="loading || !status">
      <UCard>
        <div class="space-y-4">
          <USkeleton class="h-4 w-40" />
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <USkeleton v-for="figure in 4" :key="figure" class="h-12 w-full" />
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="space-y-3">
          <USkeleton v-for="row in 4" :key="row" class="h-8 w-full" />
        </div>
      </UCard>
    </template>

    <template v-else>
      <ClamavEngineCard :status="status" />

      <div v-if="canUpdate || canReload" class="flex flex-wrap items-center gap-3">
        <UTooltip v-if="canUpdate" :text="t('clamav.actions.updateHint')">
          <UButton
            icon="i-lucide-download"
            color="primary"
            variant="solid"
            :label="t('clamav.actions.update')"
            :loading="busy === 'update'"
            :disabled="busy !== null"
            @click="() => void update()"
          />
        </UTooltip>

        <UTooltip v-if="canReload" :text="t('clamav.actions.reloadHint')">
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="subtle"
            :label="t('clamav.actions.reload')"
            :loading="busy === 'reload'"
            :disabled="busy !== null"
            @click="() => void reload()"
          />
        </UTooltip>
      </div>

      <ClamavDatabasesCard :databases="status.databases" />
    </template>
  </div>
</template>
