<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "groups", action: "access" },
    { resource: "groups", action: "view-group" },
    { resource: "groups", action: "edit-group-global-permissions" },
  ],
});

const savingGlobalPerms = ref(false);

const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { setGlobalPermissions } = useGroups();

const groupId = computed(() => String(route.params.id));
const { group, loading, refresh } = useGroupDetail(groupId);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.groups"), to: "/groups" },
    { label: group.value?.name ?? "...", to: `/groups/${groupId.value}` },
    { label: t("groups.detail.tabs.application") },
  ]);
});

async function onSaveGlobal(permissions: { resource: string; action: string }[]) {
  savingGlobalPerms.value = true;
  try {
    const updated = await setGlobalPermissions(groupId.value, permissions);
    if (group.value) group.value.globalPermissions = updated.globalPermissions;
    toast.add({ title: t("groups.detail.permissions.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("groups.detail.permissions.saveFailed"), description: (e as Error).message, color: "error" });
    await refresh();
  } finally {
    savingGlobalPerms.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-shield-alert"
      :title="t('groups.detail.alerts.application.title')"
      :description="t('groups.detail.alerts.application.description')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/groups" size="sm">
      {{ t("groups.backToList") }}
    </UButton>

    <div v-if="loading && !group" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <template v-else-if="group">
      <GroupDetailTabs :group-id="groupId" active="application" :group-name="group.name" />
      <GroupGlobalPermissions :global-permissions="group.globalPermissions" :saving="savingGlobalPerms" @save="onSaveGlobal" />
    </template>
  </div>
</template>
