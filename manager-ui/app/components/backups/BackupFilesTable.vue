<script setup lang="ts">
const emit = defineEmits<{ download: [name: string]; retrieve: [name: string] }>();
defineProps<{
  files: BackupFile[];
  downloading: string | null;
  retrieving: string | null;
  configured: boolean;
  projectReadable: boolean;
}>();

const { t } = useI18n();
const { formatDateTime } = useDateTime();

const page = ref(1);

const columns = computed<DataTableColumn<BackupFile>[]>(() => [
  { key: "name", label: t("backups.files.name"), value: (row) => row.name, primary: true },
  { key: "createdAt", label: t("backups.files.createdAt"), value: (row) => row.createdAt, searchable: false },
  { key: "bytes", label: t("backups.files.size"), value: (row) => row.bytes, searchable: false },
  { key: "location", label: t("backups.files.location"), value: locationOf },
  { key: "local", label: t("backups.files.local"), value: (row) => row.localPresent, searchable: false },
  { key: "offsite", label: t("backups.files.offsite"), value: (row) => row.offsiteTarget },
]);

function keptOffsite(row: BackupFile) {
  return row.offsiteSentAt !== null && row.offsiteDeletedAt === null;
}

function locationOf(row: BackupFile) {
  if (!row.localPresent && keptOffsite(row)) return row.offsiteTarget;
  return row.localDir || row.localProjectDir || "";
}

function offsiteLabel(row: BackupFile) {
  if (row.offsiteDeletedAt) return t("backups.files.offsiteDeleted");
  if (row.offsitePresent === true) return t("backups.files.onServer");
  if (row.offsitePresent === false) return t("backups.files.notThere");
  if (row.offsiteChecking) return t("backups.files.offsiteChecking");
  return t("backups.files.offsiteSent");
}

function offsiteColor(row: BackupFile) {
  if (row.offsiteDeletedAt) return "neutral";
  if (row.offsitePresent === true) return "success";
  if (row.offsitePresent === false) return "error";
  if (row.offsiteChecking) return "neutral";
  return "info";
}

function offsiteHint(row: BackupFile) {
  const sent = `${row.offsiteTarget} · ${row.offsiteSentAt ? formatDateTime(row.offsiteSentAt) : ""}`;
  if (row.offsiteDeletedAt) return sent;
  if (row.offsiteCheckedAt) return `${sent} · ${t("backups.files.offsiteChecked", { at: formatDateTime(row.offsiteCheckedAt) })}`;
  return row.offsiteChecking ? `${sent} · ${t("backups.files.offsiteCheckingHint")}` : sent;
}

function askDownload(name: string) {
  emit("download", name);
}

function askRetrieve(name: string) {
  emit("retrieve", name);
}
</script>

<template>
  <div class="space-y-3 min-w-0">
    <UAlert
      v-if="!projectReadable"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      :title="t('backups.files.unreadable')"
    />

    <DataTable
      v-model:page="page"
      table-id="backup-files"
      :data="files"
      :columns="columns"
      :row-key="(row: BackupFile) => row.name"
      :empty-label="t('backups.files.empty')"
    >
      <template #name="{ row }">
        <span class="font-mono text-xs">{{ row.name }}</span>
      </template>
      <template #createdAt="{ row }">
        <span class="whitespace-nowrap">{{ formatDateTime(row.createdAt) }}</span>
      </template>
      <template #bytes="{ row }">
        <span class="whitespace-nowrap">{{ formatBytes(row.bytes) }}</span>
      </template>
      <template #location="{ row }">
        <span class="font-mono text-xs break-all">{{ locationOf(row) }}</span>
      </template>
      <template #local="{ row }">
        <FullTooltip
          v-if="!row.localPresent && keptOffsite(row)"
          :text="row.localDeletedAt ? formatDateTime(row.localDeletedAt) : ''"
        >
          <span class="text-muted">-</span>
        </FullTooltip>
        <FullTooltip v-else-if="!row.localPresent" :text="row.localDeletedAt ? formatDateTime(row.localDeletedAt) : ''">
          <UBadge color="neutral" variant="subtle">{{ t("backups.files.notThere") }}</UBadge>
        </FullTooltip>
        <UBadge v-else-if="row.verifiable" color="success" variant="subtle">{{ t("backups.files.onServer") }}</UBadge>
        <FullTooltip v-else :text="t('backups.files.unverifiedHint')">
          <UBadge color="warning" variant="subtle">{{ t("backups.files.unverified") }}</UBadge>
        </FullTooltip>
      </template>
      <template #offsite="{ row }">
        <span v-if="!row.offsiteSentAt" class="text-muted">-</span>
        <FullTooltip v-else :text="offsiteHint(row)">
          <UBadge :color="offsiteColor(row)" variant="subtle" class="gap-1">
            <UIcon v-if="row.offsitePresent === null && row.offsiteChecking" name="i-lucide-loader-2" class="animate-spin" />
            {{ offsiteLabel(row) }}
          </UBadge>
        </FullTooltip>
      </template>
      <template #actions="{ row }">
        <UButton
          v-if="row.downloadable"
          icon="i-lucide-download"
          color="primary"
          variant="outline"
          size="xs"
          :loading="downloading === row.name"
          :disabled="downloading !== null"
          @click="askDownload(row.name)"
        >
          {{ t("backups.files.download") }}
        </UButton>
        <FullTooltip
          v-else-if="row.retrievable && configured"
          :text="t('backups.files.retrieveHint', { target: row.offsiteTarget })"
        >
          <UButton
            icon="i-lucide-download"
            color="primary"
            variant="outline"
            size="xs"
            :loading="retrieving === row.name"
            :disabled="retrieving !== null || downloading !== null"
            @click="askRetrieve(row.name)"
          >
            {{ retrieving === row.name ? t("backups.files.retrieving") : t("backups.files.download") }}
          </UButton>
        </FullTooltip>
      </template>
    </DataTable>
  </div>
</template>
