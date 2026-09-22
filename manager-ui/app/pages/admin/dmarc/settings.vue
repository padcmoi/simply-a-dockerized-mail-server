<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "dmarc", action: "access" },
    { resource: "dmarc", action: "manage-dmarc-settings" },
  ],
});

const { t } = useI18n();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.dmarc"), to: "/admin/dmarc" }, { label: t("dmarc.sections.settings") }]);

const { data, status } = useAsyncData(
  "dmarc-settings",
  async () => {
    const [settings, mailboxes] = await Promise.all([
      call<DmarcSettings>("/dmarc/settings"),
      call<DmarcMailbox[]>("/dmarc/mailboxes"),
    ]);
    return { settings, mailboxes };
  },
  { server: false }
);

function onSaved(settings: DmarcSettings) {
  if (data.value) data.value = { ...data.value, settings };
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <DmarcSections active="settings" />

    <UAlert
      v-if="status === 'error'"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('dmarc.loadFailed')"
    />

    <UCard v-else-if="!data">
      <div class="space-y-4">
        <USkeleton class="h-12 w-full" />
        <USkeleton class="h-32 w-full" />
        <USkeleton class="h-12 w-full" />
      </div>
    </UCard>

    <DmarcSettingsForm v-else :settings="data.settings" :mailboxes="data.mailboxes" @saved="onSaved" />
  </div>
</template>
