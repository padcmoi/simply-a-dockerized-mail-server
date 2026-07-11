<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "groups", action: "access" },
    { resource: "groups", action: "view-group" },
  ],
});

const accountOptions = ref<{ label: string; value: string }[]>([]);
const ownerPick = ref<string | undefined>(undefined);
const savingOwner = ref(false);

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { updateOwner } = useGroups();

const groupId = computed(() => String(route.params.id));
const { group, loading } = useGroupDetail(groupId);

watch(
  group,
  (g) => {
    ownerPick.value = g?.owner?.id ?? undefined;
  },
  { immediate: true }
);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.groups"), to: "/groups" },
    { label: group.value?.name ?? "...", to: `/groups/${groupId.value}` },
    { label: t("groups.detail.tabs.owner") },
  ]);
});

async function changeOwner() {
  if (ownerPick.value === undefined) return;
  savingOwner.value = true;
  try {
    const updated = await updateOwner(groupId.value, ownerPick.value);
    if (group.value) Object.assign(group.value, updated);
    toast.add({ title: t("groups.detail.owner.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("groups.detail.owner.saveFailed"), description: (e as Error).message, color: "error" });
  } finally {
    savingOwner.value = false;
  }
}

onMounted(async () => {
  const accounts = await call<{ id: string; username: string; name: string | null }[]>("/accounts/names").catch(() => []);
  accountOptions.value = accounts.map((a) => ({ label: a.name ? `${a.username} (${a.name})` : a.username, value: a.id }));
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-crown"
      :title="t('groups.detail.alerts.owner.title')"
      :description="t('groups.detail.alerts.owner.description')"
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
      <GroupDetailTabs :group-id="groupId" active="owner" :group-name="group.name" :is-protected="group.protected" />

      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("groups.detail.owner.title") }}</h3>
        </template>
        <p class="text-sm mb-3">
          {{ group.owner?.username ?? t("groups.detail.owner.unassigned") }}
        </p>
        <div class="flex flex-wrap gap-2">
          <USelectMenu
            v-model="ownerPick"
            value-key="value"
            :items="accountOptions"
            :placeholder="t('groups.detail.owner.pickPlaceholder')"
            class="min-w-[12rem]"
          />
          <UButton
            color="neutral"
            variant="outline"
            :loading="savingOwner"
            :disabled="ownerPick === undefined || ownerPick === group.owner?.id"
            @click="changeOwner"
          >
            {{ t("groups.detail.owner.change") }}
          </UButton>
        </div>
      </UCard>
    </template>
  </div>
</template>
