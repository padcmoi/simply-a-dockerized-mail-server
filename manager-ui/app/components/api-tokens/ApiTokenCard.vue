<script setup lang="ts">
const emit = defineEmits<{
  reveal: [ApiTokenItem];
  edit: [ApiTokenItem];
  regenerate: [ApiTokenItem];
  revoke: [ApiTokenItem];
  remove: [ApiTokenItem];
}>();

const props = defineProps<{ token: ApiTokenItem; canReveal: boolean; revealing: boolean }>();

const { t } = useI18n();

const struck = computed(() => (props.token.revokedAt ? "line-through opacity-50" : ""));
const expired = computed(() => props.token.expiresAt !== null && new Date(props.token.expiresAt) < new Date());

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span :class="['font-semibold', struck]">{{ token.name }}</span>
          <UBadge v-if="token.revokedAt" color="neutral" variant="subtle" size="xs">{{ t("apiTokens.revoked") }}</UBadge>
          <UBadge v-else-if="expired" color="error" variant="subtle" size="xs">{{ t("apiTokens.expired") }}</UBadge>
          <UBadge v-else color="success" variant="subtle" size="xs">{{ t("apiTokens.active") }}</UBadge>
        </div>

        <p :class="['font-mono text-xs text-muted truncate', struck]">{{ token.clientId }}</p>

        <div class="text-xs text-muted flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
          <span v-if="token.allowedIps?.length"> {{ t("apiTokens.table.ips") }}: {{ token.allowedIps.join(", ") }} </span>
          <span v-else>{{ t("apiTokens.allIps") }}</span>

          <span v-if="token.expiresAt"> {{ t("apiTokens.table.expires") }}: {{ formatDate(token.expiresAt) }} </span>
          <span v-else>{{ t("apiTokens.noExpiry") }}</span>

          <NuxtLink
            :to="`/admin/api-tokens/${token.id}/access`"
            class="text-primary hover:underline underline-offset-2"
            :title="t('apiTokens.access.title')"
          >
            {{ t("apiTokens.table.lastUsed") }}:
            {{ token.lastUsedAt ? formatDate(token.lastUsedAt) : t("apiTokens.never") }}
          </NuxtLink>
        </div>
      </div>

      <div class="flex gap-1.5 shrink-0">
        <UButton
          v-if="canReveal"
          icon="i-lucide-eye"
          size="sm"
          color="neutral"
          variant="ghost"
          square
          :loading="revealing"
          :disabled="!token.secretAvailable"
          :aria-label="t('apiTokens.secret.reveal')"
          :title="token.secretAvailable ? t('apiTokens.secret.reveal') : t('apiTokens.secret.unavailable')"
          @click="emit('reveal', token)"
        />
        <UButton
          icon="i-lucide-history"
          size="sm"
          color="neutral"
          variant="ghost"
          square
          :aria-label="t('apiTokens.access.title')"
          :title="t('apiTokens.access.title')"
          :to="`/admin/api-tokens/${token.id}/access`"
        />
        <template v-if="!token.revokedAt">
          <UButton
            icon="i-lucide-pencil"
            size="sm"
            color="neutral"
            variant="ghost"
            square
            :aria-label="t('common.save')"
            @click="emit('edit', token)"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            size="sm"
            color="neutral"
            variant="ghost"
            square
            :aria-label="t('apiTokens.regenerate')"
            @click="emit('regenerate', token)"
          />
          <UButton
            icon="i-lucide-ban"
            size="sm"
            color="warning"
            variant="ghost"
            square
            :aria-label="t('apiTokens.revokeToken')"
            @click="emit('revoke', token)"
          />
        </template>
        <UButton
          v-else
          icon="i-lucide-trash-2"
          size="sm"
          color="error"
          variant="ghost"
          square
          :aria-label="t('apiTokens.deleteToken')"
          @click="emit('remove', token)"
        />
      </div>
    </div>
  </UCard>
</template>
