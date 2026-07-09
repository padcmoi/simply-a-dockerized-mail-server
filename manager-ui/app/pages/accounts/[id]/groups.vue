<script setup lang="ts">
interface AccountDetail {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  isRoot: boolean;
  enabled: boolean;
  groups: { id: string; name: string }[];
}

definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "read" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { groups: allGroups, addMember, removeMember } = useGroups();

const account = ref<AccountDetail | null>(null);
const loading = ref(false);
const adding = ref(false);
const removingId = ref<string | null>(null);
const pickedId = ref<string | undefined>(undefined);

const accountId = computed(() => String(route.params.id));
const availableOptions = computed(() => {
  const assignedIds = new Set(account.value?.groups.map((g) => g.id) ?? []);
  return allGroups.value
    .filter((g) => !assignedIds.has(g.id))
    .map((g) => ({ label: g.name, description: g.description ?? undefined, value: g.id }));
});

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.accounts"), to: "/accounts" }, { label: account.value?.username ?? "..." }]);
});

async function load() {
  loading.value = true;
  try {
    account.value = await call<AccountDetail>(`/accounts/${accountId.value}`);
  } catch (e) {
    toast.add({ title: t("accounts.editPage.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

async function onAdd() {
  if (pickedId.value === undefined) return;
  adding.value = true;
  try {
    await addMember(pickedId.value, accountId.value);
    pickedId.value = undefined;
    toast.add({ title: t("accounts.toast.groupUpdated"), color: "success" });
    await load();
  } catch (e) {
    toast.add({ title: t("accounts.toast.groupUpdateFailed"), description: (e as Error).message, color: "error" });
  } finally {
    adding.value = false;
  }
}

async function onRemove(groupId: string) {
  removingId.value = groupId;
  try {
    await removeMember(groupId, accountId.value);
    toast.add({ title: t("accounts.toast.groupUpdated"), color: "success" });
    await load();
  } catch (e) {
    toast.add({ title: t("accounts.toast.groupUpdateFailed"), description: (e as Error).message, color: "error" });
  } finally {
    removingId.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-users-round"
      :title="t('accounts.groupsPage.alertTitle')"
      :description="t('accounts.groupsPage.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/accounts" size="sm">
      {{ t("accounts.backToList") }}
    </UButton>

    <div v-if="loading && !account" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <UCard v-else-if="account">
      <template #header>
        <h2 class="font-semibold truncate">{{ t("accounts.groupsPage.title", { username: account.username }) }}</h2>
      </template>

      <div class="flex flex-wrap gap-2 mb-4">
        <USelectMenu
          v-model="pickedId"
          value-key="value"
          :items="availableOptions"
          :placeholder="t('accounts.groupsPage.pickPlaceholder')"
          class="min-w-[12rem]"
        />
        <UButton
          icon="i-lucide-plus"
          size="sm"
          color="primary"
          :loading="adding"
          :disabled="pickedId === undefined"
          @click="onAdd"
        >
          {{ t("accounts.groupsPage.add") }}
        </UButton>
      </div>

      <p v-if="account.groups.length === 0" class="text-sm text-muted">{{ t("accounts.groupsPage.empty") }}</p>
      <ul v-else class="divide-y divide-default">
        <li v-for="g in account.groups" :key="g.id" class="flex items-center justify-between gap-2 py-2">
          <div class="flex items-center gap-2 min-w-0">
            <UIcon name="i-lucide-users-round" class="text-muted shrink-0" />
            <span class="font-medium truncate">{{ g.name }}</span>
          </div>
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="error"
            variant="ghost"
            square
            :loading="removingId === g.id"
            :title="t('accounts.groupsPage.removeTooltip')"
            @click="onRemove(g.id)"
          />
        </li>
      </ul>
    </UCard>
  </div>
</template>
