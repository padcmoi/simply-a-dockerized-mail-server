<script setup lang="ts">
const emit = defineEmits<{
  add: [string[]];
  remove: [string];
  "add-all": [];
  "remove-all": [];
  // Server-side typeahead: the parent fetches the matching non-member accounts.
  "search-accounts": [string];
}>();

// The member list is paged, searched and sorted by the API, so the state belongs to
// the page: these only carry it down to the DataTable that reads it.
const page = defineModel<number>("page", { default: 1 });
const limit = defineModel<number>("pageSize", { default: 10 });
const search = defineModel<string>("search", { default: "" });
const sortKey = defineModel<string>("sortKey", { default: "" });
const sortDirection = defineModel<"asc" | "desc">("sortDirection", { default: "asc" });

defineProps<{
  members: GroupMember[];
  // Current typeahead matches (top N non-members), NOT the whole account table.
  accountOptions: { label: string; value: string }[];
  optionsLoading: boolean;
  adding: boolean;
  // Root-only bulk controls: assign every account / clear the whole membership.
  isRoot: boolean;
  bulkLoading: boolean;
  // Server-side paginated list state (see members.vue / usePaginatedList).
  loading: boolean;
  hasLoadedOnce: boolean;
  searching: boolean;
  // How many members the group has under the current search, which is what the pager
  // counts against: `members` is one page of them, never the whole list.
  total: number;
  // Counts from the group detail (server COUNTs, search-independent): members in
  // this group, and accounts still assignable (non-members). Drive the two bulk
  // buttons' counters and disabled state -- never derived from the picker list,
  // which now only holds the current typeahead page.
  memberTotal: number;
  nonMemberTotal: number;
}>();

// Multi-select. Bind whole option objects, NOT a value-key: with an async items
// list a selected id would have no matching item to resolve its label from (the
// list changes on search/refetch), so the field rendered raw ids. Each object
// carries its own label, so selections always display correctly.
const picked = ref<{ label: string; value: string }[]>([]);
const searchTerm = ref("");

const { t } = useI18n();

// `displayName` and `email` are also the two columns the API sorts on, so a click on
// either header is a query it can answer (see GROUP_MEMBERS_SORTABLE_COLUMNS).
const columns = computed<DataTableColumn<GroupMember>[]>(() => [
  {
    key: "displayName",
    label: t("groups.detail.members.name"),
    value: (row) => row.displayName ?? row.email,
    primary: true,
  },
  { key: "email", label: t("common.address"), value: (row) => row.email },
]);

// Debounced so a fast typist fires one request after they pause, not one per
// keystroke -- the whole point: never hammer the API with the full table.
const emitSearch = useDebounceFn((term: string) => emit("search-accounts", term), 300);
watch(searchTerm, (term) => emitSearch(term));

function onAdd() {
  if (picked.value.length === 0) return;
  emit(
    "add",
    picked.value.map((p) => p.value)
  );
  picked.value = [];
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold">{{ t("groups.detail.members.title") }}</h3>
          <UIcon v-if="loading && hasLoadedOnce" name="i-lucide-loader-2" class="text-primary animate-spin" />
        </div>
        <div v-if="isRoot" class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-users"
            size="xs"
            color="primary"
            variant="soft"
            :loading="bulkLoading"
            :disabled="nonMemberTotal === 0"
            @click="emit('add-all')"
          >
            {{ t("groups.detail.members.assignAll") }} ({{ nonMemberTotal }})
          </UButton>
          <UButton
            icon="i-lucide-user-x"
            size="xs"
            color="error"
            variant="soft"
            :loading="bulkLoading"
            :disabled="memberTotal === 0"
            @click="emit('remove-all')"
          >
            {{ t("groups.detail.members.removeAll") }} ({{ memberTotal }})
          </UButton>
        </div>
      </div>
    </template>

    <div class="flex flex-wrap gap-2 mb-4">
      <USelectMenu
        v-model="picked"
        v-model:search-term="searchTerm"
        multiple
        :items="accountOptions"
        :loading="optionsLoading"
        :ignore-filter="true"
        :reset-search-term-on-select="false"
        :placeholder="t('groups.detail.members.pickPlaceholder')"
        class="min-w-[12rem]"
      />

      <UButton
        icon="i-lucide-user-plus"
        size="sm"
        color="primary"
        :loading="adding"
        :disabled="picked.length === 0"
        @click="onAdd"
      >
        {{ t("groups.detail.members.add") }}
      </UButton>
    </div>

    <div v-if="!hasLoadedOnce" class="space-y-2">
      <USkeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-md" />
    </div>

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:sort-key="sortKey"
      v-model:sort-direction="sortDirection"
      :data="members"
      :columns="columns"
      :total="total"
      :loading="loading"
      :row-key="(row: GroupMember) => row.id"
      :empty-label="searching ? t('common.noResults') : t('groups.detail.members.empty')"
    >
      <template #displayName="{ row }">
        <div class="min-w-0 flex items-center gap-2">
          <UAvatar :alt="row.displayName ?? row.email" size="xs" />
          <span class="font-medium truncate">{{ row.displayName ?? row.email }}</span>
        </div>
      </template>

      <template #actions="{ row }">
        <UButton
          icon="i-lucide-user-minus"
          size="xs"
          color="error"
          variant="ghost"
          square
          :title="t('groups.detail.members.remove')"
          @click="emit('remove', row.id)"
        />
      </template>
    </DataTable>
  </UCard>
</template>
