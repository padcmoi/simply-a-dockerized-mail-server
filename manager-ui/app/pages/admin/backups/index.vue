<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.backups") }]);

const { overview, files, loaded, failed, downloading, retrieving, load, download, retrieve } = useBackups();
await useAsyncData("backups-overview", () => load(), { server: false });

watch(useDataRefresh().tick, load);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-database-backup"
      :title="t('backups.title')"
      :description="t('backups.subtitle')"
    />

    <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('backups.loadFailed')" />

    <template v-else-if="!loaded || !overview">
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <USkeleton v-for="card in 3" :key="card" class="h-40 w-full" />
      </div>
      <USkeleton class="h-48 w-full" />
    </template>

    <template v-else>
      <UAlert
        v-if="!overview.configured"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="t('backups.notConfigured')"
        :description="t('backups.notConfiguredHint')"
      />

      <template v-else>
        <BackupRequestStatus v-if="overview.pending" :pending="overview.pending" :status="overview.lastRequest" />
        <BackupSummary :overview="overview" />

        <UCard>
          <template #header>
            <h2 class="font-semibold">{{ t("backups.runs.title") }}</h2>
          </template>
          <BackupRunsTable />
        </UCard>
      </template>

      <UCard v-if="overview.configured || files.length">
        <template #header>
          <h2 class="font-semibold">{{ t("backups.files.title") }}</h2>
        </template>
        <BackupFilesTable
          :files="files"
          :downloading="downloading"
          :retrieving="retrieving"
          :configured="overview.configured"
          :project-readable="overview.projectReadable"
          @download="download"
          @retrieve="retrieve"
        />
      </UCard>
    </template>
  </div>
</template>
