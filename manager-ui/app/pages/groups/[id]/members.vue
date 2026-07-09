<script setup lang="ts">
import type { GroupMember } from "~/composables/useGroups";

definePageMeta({
  requiredGlobal: [
    { resource: "groups", action: "access" },
    { resource: "groups", action: "read" },
  ],
});

const members = ref<GroupMember[]>([]);
const accountOptions = ref<{ label: string; value: string }[]>([]);
const membersLoading = ref(false);
const addingMember = ref(false);

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { listMembers, addMember, removeMember } = useGroups();

const groupId = computed(() => String(route.params.id));
const { group, loading } = useGroupDetail(groupId);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.groups"), to: "/groups" },
    { label: group.value?.name ?? "...", to: `/groups/${groupId.value}` },
    { label: t("groups.detail.tabs.members") },
  ]);
});

async function loadMembers() {
  membersLoading.value = true;
  try {
    const [memberList, accounts] = await Promise.all([
      listMembers(groupId.value),
      call<{ id: string; username: string; name: string | null }[]>("/accounts/names"),
    ]);
    members.value = memberList;
    accountOptions.value = accounts.map((a) => ({ label: a.name ? `${a.username} (${a.name})` : a.username, value: a.id }));
  } catch (e) {
    toast.add({ title: t("groups.detail.members.addFailed"), description: (e as Error).message, color: "error" });
  } finally {
    membersLoading.value = false;
  }
}

async function onAddMember(accountId: string) {
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

async function onRemoveMember(accountId: string) {
  try {
    members.value = await removeMember(groupId.value, accountId);
    if (group.value) group.value.memberCount = members.value.length;
  } catch (e) {
    toast.add({ title: t("groups.detail.members.removeFailed"), description: (e as Error).message, color: "error" });
  }
}

onMounted(loadMembers);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-users"
      :title="t('groups.detail.alerts.members.title')"
      :description="t('groups.detail.alerts.members.description')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/groups" size="sm">
      {{ t("groups.backToList") }}
    </UButton>

    <div v-if="(loading && !group) || membersLoading" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <template v-else-if="group">
      <GroupDetailTabs :group-id="groupId" active="members" :group-name="group.name" />

      <GroupMembersCard
        :members="members"
        :account-options="accountOptions"
        :adding="addingMember"
        @add="onAddMember"
        @remove="onRemoveMember"
      />
    </template>
  </div>
</template>
