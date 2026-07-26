<script setup lang="ts">
interface ManagerAccount {
  id: string;
  email: string;
  displayName: string | null;
  isRoot: boolean;
  enabled: boolean;
  groups: { id: string; name: string }[];
}

const emit = defineEmits<{ delete: [] }>();

defineProps<{
  account: ManagerAccount;
}>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <UAvatar :alt="account.displayName ?? account.email" size="sm" />
        <NuxtLink
          :to="`/accounts/${account.id}`"
          class="font-semibold truncate break-all text-primary hover:underline underline-offset-2 transition-colors"
        >
          {{ account.email }}
        </NuxtLink>
        <UBadge v-if="account.isRoot" color="warning" variant="subtle" size="xs">root</UBadge>
      </div>
      <UBadge :color="account.enabled ? 'success' : 'neutral'" variant="subtle" size="sm" class="shrink-0">
        {{ account.enabled ? t("common.active") : t("common.inactive") }}
      </UBadge>
    </div>
    <div class="mt-3 space-y-1.5 text-sm">
      <div v-if="account.displayName" class="flex gap-2">
        <span class="text-muted w-20 shrink-0">{{ t("accounts.table.name") }}</span>
        <span>{{ account.displayName }}</span>
      </div>
      <div class="flex gap-2 items-start">
        <span class="text-muted w-20 shrink-0">{{ t("accounts.table.group") }}</span>
        <span v-if="account.isRoot" class="italic text-muted text-xs">{{ t("accounts.table.rootAccess") }}</span>
        <div v-else-if="account.groups.length" class="flex flex-wrap gap-1">
          <UBadge v-for="g in account.groups" :key="g.id" color="neutral" variant="subtle" size="xs">{{ g.name }}</UBadge>
        </div>
        <span v-else class="text-dimmed text-xs">{{ t("accounts.table.noGroup") }}</span>
      </div>
    </div>
    <div v-if="!account.isRoot" class="mt-3 pt-3 border-t border-default flex flex-wrap items-center gap-2">
      <UButton icon="i-lucide-users-round" size="sm" color="neutral" variant="outline" :to="`/accounts/${account.id}/groups`">
        {{ t("accounts.table.manageGroups") }}
      </UButton>
      <UButton icon="i-lucide-pencil" size="sm" color="neutral" variant="outline" :to="`/accounts/${account.id}/edit`">
        {{ t("accounts.table.editAccount") }}
      </UButton>
      <UButton icon="i-lucide-trash-2" size="sm" color="error" variant="outline" @click="emit('delete')">
        {{ t("common.delete") }}
      </UButton>
    </div>
  </UCard>
</template>
