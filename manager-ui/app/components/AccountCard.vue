<script setup lang="ts">
interface AccountDomain {
  id: number;
  domain: string;
}

interface ManagerAccount {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  isRoot: boolean;
  enabled: boolean;
  domains: AccountDomain[];
}

const emit = defineEmits<{ openAcl: []; revoke: [] }>();

defineProps<{ account: ManagerAccount }>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <UAvatar :alt="account.name ?? account.username" size="sm" />
        <span class="font-semibold truncate">{{ account.username }}</span>
        <UBadge v-if="account.isRoot" color="warning" variant="subtle" size="xs">root</UBadge>
      </div>
      <UBadge :color="account.enabled ? 'success' : 'neutral'" variant="subtle" size="sm" class="shrink-0">
        {{ account.enabled ? t("common.active") : t("common.inactive") }}
      </UBadge>
    </div>
    <div class="mt-3 space-y-1.5 text-sm">
      <div v-if="account.name" class="flex gap-2">
        <span class="text-muted w-20 shrink-0">{{ t("accounts.table.name") }}</span>
        <span>{{ account.name }}</span>
      </div>
      <div v-if="account.email" class="flex gap-2">
        <span class="text-muted w-20 shrink-0">{{ t("accounts.table.email") }}</span>
        <span class="break-all">{{ account.email }}</span>
      </div>
      <div class="flex gap-2 items-start">
        <span class="text-muted w-20 shrink-0">{{ t("accounts.table.domains") }}</span>
        <span v-if="account.isRoot" class="italic text-muted text-xs">{{ t("invite.allDomains") }}</span>
        <span v-else-if="account.domains.length === 0" class="text-dimmed">-</span>
        <div v-else class="flex flex-wrap gap-1">
          <UBadge v-for="d in account.domains" :key="d.id" color="neutral" variant="subtle" size="xs">{{ d.domain }}</UBadge>
        </div>
      </div>
    </div>
    <div v-if="!account.isRoot" class="mt-3 pt-3 border-t border-default flex flex-wrap gap-2">
      <UButton icon="i-lucide-shield" size="sm" color="neutral" variant="outline" @click="emit('openAcl')">
        {{ t("accounts.acl.title") }}
      </UButton>
      <UButton v-if="account.enabled" icon="i-lucide-user-x" size="sm" color="error" variant="outline" @click="emit('revoke')">
        {{ t("common.revoke") }}
      </UButton>
    </div>
  </UCard>
</template>
