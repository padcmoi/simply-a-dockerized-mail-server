<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "groups", action: "access" },
    { resource: "groups", action: "read" },
  ],
});

const savingInfo = ref(false);
const form = reactive({ name: "", description: "", isDefault: false });

const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { update } = useGroups();

const groupId = computed(() => String(route.params.id));
const { group, loading } = useGroupDetail(groupId);

watch(
  group,
  (g) => {
    if (!g) return;
    form.name = g.name;
    form.description = g.description ?? "";
    form.isDefault = g.isDefault ?? false;
  },
  { immediate: true }
);

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.groups"), to: "/groups" }, { label: group.value?.name ?? "..." }]);
});

async function saveInfo() {
  savingInfo.value = true;
  try {
    const updated = await update(groupId.value, {
      name: form.name,
      description: form.description || null,
      isDefault: form.isDefault,
    });
    if (group.value) Object.assign(group.value, updated);
    toast.add({ title: t("groups.detail.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("groups.detail.saveFailed"), description: (e as Error).message, color: "error" });
  } finally {
    savingInfo.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-info"
      :title="t('groups.detail.alerts.info.title')"
      :description="t('groups.detail.alerts.info.description')"
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
      <GroupDetailTabs :group-id="groupId" active="info" :group-name="group.name" />

      <UCard>
        <template #header>
          <h2 class="font-semibold truncate">{{ group.name }}</h2>
        </template>
        <UFormField :label="t('groups.detail.nameLabel')">
          <UInput v-model="form.name" class="w-full" />
        </UFormField>
        <UFormField :label="t('groups.detail.descriptionLabel')" class="mt-3">
          <UTextarea v-model="form.description" class="w-full" :rows="3" />
        </UFormField>
        <UCheckbox
          v-model="form.isDefault"
          class="mt-3"
          variant="card"
          :ui="{ root: 'border-0 rounded-none p-0' }"
          :label="t('groups.form.isDefault')"
          :description="t('groups.form.isDefaultHint')"
        />
        <template #footer>
          <div class="flex justify-end">
            <UButton color="primary" :loading="savingInfo" @click="saveInfo">{{ t("groups.detail.save") }}</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </div>
</template>
