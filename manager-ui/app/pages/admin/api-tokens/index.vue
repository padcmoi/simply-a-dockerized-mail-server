<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "api-tokens", action: "access" },
    { resource: "api-tokens", action: "list-api-tokens" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.apiTokens") }]);

const {
  tokens,
  loading,
  canReveal,
  modalOpen,
  revealOpen,
  editingToken,
  revealedToken,
  revealMode,
  revealingId,
  saving,
  confirmOpen,
  pending,
  openCreate,
  openEdit,
  onSubmit,
  onConfirmed,
  askRevoke,
  askDelete,
  askRegenerate,
  onReveal,
  onRevealDismissed,
} = useApiTokenActions();
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-key"
      :title="t('apiTokens.alertTitle')"
      :description="t('apiTokens.alertDescription')"
    />

    <div class="flex items-center justify-between">
      <h2 class="font-semibold text-lg">{{ t("apiTokens.listTitle") }}</h2>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-book-open"
          color="neutral"
          variant="subtle"
          trailing-icon="i-lucide-external-link"
          to="/api/doc"
          target="_blank"
          external
        >
          {{ t("apiTokens.apiDoc") }}
        </UButton>
        <UButton icon="i-lucide-plus" color="primary" @click="openCreate">
          {{ t("apiTokens.newToken") }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="animate-spin text-muted size-6" />
    </div>

    <div v-else-if="tokens.length === 0" class="flex flex-col items-center gap-3 py-10 text-center">
      <UIcon name="i-lucide-key" class="text-3xl text-muted" />
      <p class="text-sm text-muted">{{ t("apiTokens.empty") }}</p>
    </div>

    <div v-else class="space-y-3">
      <ApiTokenCard
        v-for="token in tokens"
        :key="token.id"
        :token="token"
        :can-reveal="canReveal"
        :revealing="revealingId === token.id"
        @reveal="onReveal"
        @edit="openEdit"
        @regenerate="askRegenerate"
        @revoke="askRevoke"
        @remove="askDelete"
      />
    </div>

    <ApiTokenModal
      :open="modalOpen"
      :token="editingToken ?? undefined"
      :saving="saving"
      @update:open="modalOpen = $event"
      @submit="onSubmit"
    />

    <ConfirmModal
      v-model:open="confirmOpen"
      :type="pending?.type ?? 'danger'"
      :title="pending?.title"
      :description="pending?.description"
      @confirm="onConfirmed"
    />

    <ApiTokenRevealModal
      :open="revealOpen"
      :token="revealedToken"
      :mode="revealMode"
      @update:open="revealOpen = $event"
      @dismissed="onRevealDismissed"
    />
  </div>
</template>
