<script setup lang="ts">
import type { GroupMember } from "~/composables/useGroups";

const emit = defineEmits<{
  add: [string[]];
  remove: [string];
  "add-all": [];
  "remove-all": [];
  // Server-side typeahead: the parent fetches the matching non-member accounts.
  "search-accounts": [string];
}>();

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

    <div class="mb-4">
      <slot name="toolbar" />
    </div>

    <div v-if="!hasLoadedOnce" class="space-y-2">
      <USkeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-md" />
    </div>
    <p v-else-if="members.length === 0" class="text-sm text-muted py-2">
      {{ searching ? t("common.noResults") : t("groups.detail.members.empty") }}
    </p>

    <ul v-else class="divide-y divide-default">
      <li v-for="m in members" :key="m.id" class="flex items-center justify-between gap-2 py-2">
        <div class="min-w-0 flex items-center gap-2">
          <UAvatar :alt="m.displayName ?? m.email" size="xs" />
          <div class="min-w-0">
            <p class="font-medium truncate">{{ m.displayName ?? m.email }}</p>
            <p v-if="m.displayName" class="text-xs text-muted truncate">{{ m.email }}</p>
          </div>
        </div>

        <UButton
          icon="i-lucide-user-minus"
          size="xs"
          color="error"
          variant="ghost"
          square
          :title="t('groups.detail.members.remove')"
          @click="emit('remove', m.id)"
        />
      </li>
    </ul>
  </UCard>
</template>
