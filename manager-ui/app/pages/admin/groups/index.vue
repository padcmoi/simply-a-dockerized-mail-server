<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  requiredGlobal: [
    { resource: "groups", action: "access" },
    { resource: "groups", action: "list-groups" },
  ],
});

const modalOpen = ref(false);
const saving = ref(false);
const confirmOpen = ref(false);
const pendingDelete = ref<GroupItem | null>(null);

// Declared once for both renderings: DataTable decides on its own width whether
// these rows are a table or a block each, so this page no longer carries a
// desktop table beside a list of cards.
//
// `ownerEmail`/`memberCount` are computed after the query (groups.service.ts's
// enrichGroups) and have no column to order by, so the API cannot sort on them.
const columns = computed<DataTableColumn<GroupItem>[]>(() => [
  { key: "name", label: t("groups.table.name"), value: (row) => row.name, primary: true },
  { key: "description", label: t("groups.table.description"), value: (row) => row.description ?? "" },
  { key: "ownerEmail", label: t("groups.table.owner"), value: (row) => row.ownerEmail ?? "", sortable: false },
  { key: "memberCount", label: t("groups.table.members"), value: (row) => row.memberCount, sortable: false },
]);

// Ids of the groups the current account belongs to (its own memberships, from
// the session -- includes invisible ones, though those never appear in this
// list for a non-root anyway). Drives the "you are a member" green check.
const myGroupIds = computed(() => new Set((auth.session?.groups ?? []).map((g) => g.id)));

const { t } = useI18n();
const auth = useAuthStore();
const { set: setBreadcrumb } = useBreadcrumb();
const toast = useToast();
setBreadcrumb([{ label: t("nav.groups") }]);

// Table display is paginated separately from useGroups(), which stays
// unpaginated for its other consumers (accounts invite modal, accounts/[id]/groups.vue's
// group picker) -- only create/remove are reused here.
const { create, remove } = useGroups();
const {
  items: groups,
  total,
  loading,
  hasLoadedOnce,
  page,
  limit,
  search,
  sortBy,
  sortDir,
  load,
} = usePaginatedList<GroupItem>("groups-list", "/groups", "createdAt");

function openCreate() {
  modalOpen.value = true;
}

async function onSubmit(data: { name: string; description?: string | null }) {
  saving.value = true;
  try {
    await create(data);
    toast.add({ title: t("groups.toast.created"), color: "success" });
    modalOpen.value = false;
    await load();
  } catch (e) {
    toast.add({ title: t("groups.toast.createFailed"), description: (e as Error).message, color: "error" });
  } finally {
    saving.value = false;
  }
}

function requestDelete(group: GroupItem) {
  pendingDelete.value = group;
  confirmOpen.value = true;
}

async function onDeleteConfirmed() {
  const group = pendingDelete.value;
  if (!group) return;
  try {
    await remove(group.id);
    toast.add({ title: t("groups.toast.deleted"), color: "success" });
    await load();
  } catch (e) {
    toast.add({ title: t("groups.toast.deleteFailed"), description: (e as Error).message, color: "error" });
  } finally {
    pendingDelete.value = null;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-users-round"
        :title="t('groups.alertTitle')"
        :description="t('groups.alertDescription')"
        class="flex-1 min-w-[16rem]"
      />
    </div>

    <div class="flex justify-end">
      <UButton icon="i-lucide-plus" color="primary" @click="openCreate">
        {{ t("groups.newGroup") }}
      </UButton>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="4" />

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      :data="groups"
      :columns="columns"
      :total="total"
      :loading="loading"
      :row-key="(row: GroupItem) => row.id"
      :empty-label="t('groups.empty')"
    >
      <template #name="{ row }">
        <div class="flex items-center gap-2 min-w-0">
          <NuxtLink :to="`/admin/groups/${row.id}`" class="font-medium hover:underline truncate min-w-0">
            {{ row.name }}
          </NuxtLink>
          <UBadge v-if="row.isDefault" color="primary" variant="subtle" size="xs" class="shrink-0">
            {{ t("groups.defaultBadge") }}
          </UBadge>
          <UIcon v-if="row.protected" name="i-lucide-lock" class="shrink-0 text-warning" :title="t('groups.protectedBadge')" />
          <UIcon
            v-if="myGroupIds.has(row.id)"
            name="i-lucide-circle-check"
            class="shrink-0 text-success"
            :title="t('groups.memberBadge')"
          />
        </div>
      </template>

      <template #description="{ row }">
        <span class="text-muted text-sm">{{ row.description || t("groups.noDescription") }}</span>
      </template>

      <template #ownerEmail="{ row }">
        <span class="text-muted text-sm">{{ row.ownerEmail ?? "-" }}</span>
      </template>

      <template #actions="{ row }">
        <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" square @click="requestDelete(row)" />
      </template>
    </DataTable>

    <GroupFormModal v-model:open="modalOpen" :saving="saving" @submit="onSubmit" />

    <ConfirmModal v-model:open="confirmOpen" :title="t('groups.confirmDelete')" @confirm="onDeleteConfirmed" />
  </div>
</template>
