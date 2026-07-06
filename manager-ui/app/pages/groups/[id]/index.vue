<script setup lang="ts">
import type { GroupDetail, GroupMember } from "~/composables/useGroups";

definePageMeta({
  requiredGlobal: [
    { resource: "groups", action: "access" },
    { resource: "groups", action: "read" },
  ],
});

const group = ref<GroupDetail | null>(null);
const members = ref<GroupMember[]>([]);
const accountOptions = ref<{ label: string; value: number }[]>([]);
const domainOptions = ref<{ label: string; value: number }[]>([]);
const ownerPick = ref<number | undefined>(undefined);
const loading = ref(false);
const savingInfo = ref(false);
const savingOwner = ref(false);
const addingMember = ref(false);
const savingGlobalPerms = ref(false);
const savingDomainPerms = ref(false);
const form = reactive({ name: "", description: "", isDefault: false });

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { update, updateOwner, getDetail, setGlobalPermissions, setDomainPermissions, listMembers, addMember, removeMember } =
  useGroups();

const groupId = computed(() => Number(route.params.id));

watch(useDataRefresh().tick, load);

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.groups"), to: "/groups" }, { label: group.value?.name ?? "..." }]);
});

async function load() {
  loading.value = true;
  try {
    const [detail, memberList, accounts, domains] = await Promise.all([
      getDetail(groupId.value),
      listMembers(groupId.value),
      call<{ id: number; username: string; name: string | null }[]>("/accounts/names"),
      call<{ id: number; domain: string }[]>("/domains"),
    ]);
    group.value = detail;
    members.value = memberList;
    form.name = detail.name;
    form.description = detail.description ?? "";
    form.isDefault = detail.isDefault ?? false;
    ownerPick.value = detail.owner?.id ?? undefined;
    accountOptions.value = accounts.map((a) => ({ label: a.name ? `${a.username} (${a.name})` : a.username, value: a.id }));
    domainOptions.value = domains.map((d) => ({ label: d.domain, value: d.id }));
  } catch (e) {
    toast.add({ title: t("groups.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

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

async function onAddMember(accountId: number) {
  addingMember.value = true;
  try {
    members.value = await addMember(groupId.value, accountId);
    if (group.value) group.value.memberCount = members.value.length;
  } catch (e) {
    toast.add({ title: t("groups.detail.members.addFailed"), description: (e as Error).message, color: "error" });
  } finally {
    addingMember.value = false;
  }
}

async function onRemoveMember(accountId: number) {
  try {
    members.value = await removeMember(groupId.value, accountId);
    if (group.value) group.value.memberCount = members.value.length;
  } catch (e) {
    toast.add({ title: t("groups.detail.members.removeFailed"), description: (e as Error).message, color: "error" });
  }
}

async function onSaveGlobal(permissions: { resource: string; action: string }[]) {
  savingGlobalPerms.value = true;
  try {
    const updated = await setGlobalPermissions(groupId.value, permissions);
    if (group.value) group.value.globalPermissions = updated.globalPermissions;
    toast.add({ title: t("groups.detail.permissions.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("groups.detail.permissions.saveFailed"), description: (e as Error).message, color: "error" });
  } finally {
    savingGlobalPerms.value = false;
  }
}

async function onSaveDomain(permissions: { domainId: number; resource: string; action: string }[]) {
  savingDomainPerms.value = true;
  try {
    const updated = await setDomainPermissions(groupId.value, permissions);
    if (group.value) group.value.domainPermissions = updated.domainPermissions;
    toast.add({ title: t("groups.detail.permissions.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("groups.detail.permissions.saveFailed"), description: (e as Error).message, color: "error" });
  } finally {
    savingDomainPerms.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-users-round"
      :title="t('groups.detail.alertTitle')"
      :description="t('groups.detail.alertDescription')"
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

      <GroupMembersCard
        :members="members"
        :account-options="accountOptions"
        :adding="addingMember"
        @add="onAddMember"
        @remove="onRemoveMember"
      />

      <GroupPermissionsPanel
        :global-permissions="group.globalPermissions"
        :domain-permissions="group.domainPermissions"
        :domain-options="domainOptions"
        :saving-global="savingGlobalPerms"
        :saving-domain="savingDomainPerms"
        @save-global="onSaveGlobal"
        @save-domain="onSaveDomain"
      />
    </template>
  </div>
</template>
