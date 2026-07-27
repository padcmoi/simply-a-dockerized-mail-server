<script setup lang="ts">
import type { GroupItem } from "~/composables/useGroups";
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

// `ownerEmail`/`memberCount` have no matching real column (computed
// post-query, see groups.service.ts's enrichGroups) -- not sortable, stay
// plain headers. Same source feeds the desktop column headers below and
// ListToolbar's mobile sort select.
const SORTABLE_COLUMNS = computed(() => [
  { key: "name", label: t("groups.table.name") },
  { key: "description", label: t("groups.table.description") },
]);

const columns = computed(() => [
  { accessorKey: "name", header: header("name", t("groups.table.name")) },
  { accessorKey: "description", header: header("description", t("groups.table.description")) },
  { accessorKey: "ownerEmail", header: t("groups.table.owner") },
  { accessorKey: "memberCount", header: t("groups.table.members") },
  { id: "actions", header: "" },
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
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

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

    <ListToolbar
      v-model:search="search"
      v-model:limit="limit"
      v-model:sort-by="sortBy"
      v-model:sort-dir="sortDir"
      :total="total"
      :sortable-columns="SORTABLE_COLUMNS"
    />

    <ListSkeleton v-if="!hasLoadedOnce" :columns="4" />

    <template v-else>
      <UCard class="hidden xl:block">
        <UTable :loading="loading" :data="groups" :columns="columns" sticky>
          <template #name-cell="{ row }">
            <div class="flex items-center gap-2 min-w-0 max-w-64">
              <NuxtLink :to="`/admin/groups/${row.original.id}`" class="font-medium hover:underline truncate min-w-0">{{
                row.original.name
              }}</NuxtLink>
              <UBadge v-if="row.original.isDefault" color="primary" variant="subtle" size="xs" class="shrink-0">{{
                t("groups.defaultBadge")
              }}</UBadge>
              <UIcon
                v-if="row.original.protected"
                name="i-lucide-lock"
                class="shrink-0 text-warning"
                :title="t('groups.protectedBadge')"
              />
              <UIcon
                v-if="myGroupIds.has(row.original.id)"
                name="i-lucide-circle-check"
                class="shrink-0 text-success"
                :title="t('groups.memberBadge')"
              />
            </div>
          </template>
          <template #description-cell="{ row }">
            <span class="text-muted text-sm truncate block max-w-80">{{
              row.original.description || t("groups.noDescription")
            }}</span>
          </template>
          <template #ownerEmail-cell="{ row }">
            <span class="text-muted text-sm">{{ row.original.ownerEmail ?? "-" }}</span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                square
                @click="requestDelete(row.original)"
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <div class="xl:hidden space-y-3">
        <p v-if="groups.length === 0" class="text-sm text-muted text-center py-6">{{ t("groups.empty") }}</p>
        <GroupCard
          v-for="group in groups"
          v-else
          :key="group.id"
          :group="group"
          :is-member="myGroupIds.has(group.id)"
          @delete="requestDelete(group)"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <GroupFormModal v-model:open="modalOpen" :saving="saving" @submit="onSubmit" />

    <ConfirmModal v-model:open="confirmOpen" :title="t('groups.confirmDelete')" @confirm="onDeleteConfirmed" />
  </div>
</template>
