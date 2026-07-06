<script setup lang="ts">
import type { ApiTokenItem, CreatedToken } from "~/composables/useApiTokens";

definePageMeta({});

const modalOpen = ref(false);
const revealOpen = ref(false);
const editingToken = ref<ApiTokenItem | null>(null);
const revealedToken = ref<CreatedToken | null>(null);
const saving = ref(false);

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const toast = useToast();
setBreadcrumb([{ label: t("nav.apiTokens") }]);

const { tokens, loading, create, update, revoke, deleteToken, abandonToken, regenerate } = useApiTokens();

function openCreate() {
  editingToken.value = null;
  modalOpen.value = true;
}

function openEdit(token: ApiTokenItem) {
  editingToken.value = token;
  modalOpen.value = true;
}

async function onSubmit(data: { name: string; allowedIps?: string[]; expiresAt?: string }) {
  saving.value = true;
  try {
    if (editingToken.value) {
      await update(editingToken.value.id, {
        name: data.name,
        allowedIps: data.allowedIps ?? null,
        expiresAt: data.expiresAt ?? null,
      });
      toast.add({ title: t("apiTokens.toast.updated"), color: "success" });
      modalOpen.value = false;
    } else {
      const created = await create(data);
      modalOpen.value = false;
      revealedToken.value = created;
      revealOpen.value = true;
      toast.add({ title: t("apiTokens.toast.created"), color: "success" });
    }
  } catch (e) {
    toast.add({ title: t("apiTokens.toast.saveFailed"), description: (e as Error).message, color: "error" });
  } finally {
    saving.value = false;
  }
}

async function onRevoke(token: ApiTokenItem) {
  try {
    await revoke(token.id);
    toast.add({ title: t("apiTokens.toast.revoked"), color: "success" });
  } catch (e) {
    toast.add({ title: t("apiTokens.toast.revokeFailed"), description: (e as Error).message, color: "error" });
  }
}

async function onDeleteToken(token: ApiTokenItem) {
  try {
    await deleteToken(token.id);
    toast.add({ title: t("apiTokens.toast.deleted"), color: "success" });
  } catch (e) {
    toast.add({ title: t("apiTokens.toast.deleteFailed"), description: (e as Error).message, color: "error" });
  }
}

async function onRegenerate(token: ApiTokenItem) {
  try {
    const created = await regenerate(token.id);
    revealedToken.value = created;
    revealOpen.value = true;
    toast.add({ title: t("apiTokens.toast.regenerated"), color: "success" });
  } catch (e) {
    toast.add({ title: t("apiTokens.toast.regenerateFailed"), description: (e as Error).message, color: "error" });
  }
}

async function onRevealDismissed() {
  const token = revealedToken.value;
  if (!token) return;
  try {
    await abandonToken(token.id);
    toast.add({ title: t("apiTokens.toast.keyNotSaved"), color: "warning" });
  } catch {
    // silent
  }
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function isExpired(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-key"
      :title="t('apiTokens.alertTitle')"
      :description="t('apiTokens.alertDescription')"
    />

    <div class="flex items-center justify-between">
      <h2 class="font-semibold text-lg">{{ t("apiTokens.listTitle") }}</h2>
      <UButton icon="i-lucide-plus" color="primary" @click="openCreate">
        {{ t("apiTokens.newToken") }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="animate-spin text-muted size-6" />
    </div>

    <div v-else-if="tokens.length === 0" class="flex flex-col items-center gap-3 py-10 text-center">
      <UIcon name="i-lucide-key" class="text-3xl text-muted" />
      <p class="text-sm text-muted">{{ t("apiTokens.empty") }}</p>
    </div>

    <div v-else class="space-y-3">
      <UCard v-for="token in tokens" :key="token.id">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span :class="['font-semibold', token.revokedAt ? 'line-through opacity-50' : '']">{{ token.name }}</span>
              <UBadge v-if="token.revokedAt" color="neutral" variant="subtle" size="xs">{{ t("apiTokens.revoked") }}</UBadge>
              <UBadge v-else-if="isExpired(token.expiresAt)" color="error" variant="subtle" size="xs">{{
                t("apiTokens.expired")
              }}</UBadge>
              <UBadge v-else color="success" variant="subtle" size="xs">{{ t("apiTokens.active") }}</UBadge>
            </div>

            <p :class="['font-mono text-xs text-muted truncate', token.revokedAt ? 'line-through opacity-50' : '']">
              {{ token.clientId }}
            </p>

            <div class="text-xs text-muted flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              <span v-if="token.allowedIps?.length"> {{ t("apiTokens.table.ips") }}: {{ token.allowedIps.join(", ") }} </span>
              <span v-else>{{ t("apiTokens.allIps") }}</span>

              <span v-if="token.expiresAt"> {{ t("apiTokens.table.expires") }}: {{ formatDate(token.expiresAt) }} </span>
              <span v-else>{{ t("apiTokens.noExpiry") }}</span>

              <span>
                {{ t("apiTokens.table.lastUsed") }}:
                {{ token.lastUsedAt ? formatDate(token.lastUsedAt) : t("apiTokens.never") }}
              </span>
            </div>
          </div>

          <div class="flex gap-1.5 shrink-0">
            <template v-if="!token.revokedAt">
              <UButton
                icon="i-lucide-pencil"
                size="sm"
                color="neutral"
                variant="ghost"
                square
                :aria-label="t('common.save')"
                @click="openEdit(token)"
              />
              <UButton
                icon="i-lucide-refresh-cw"
                size="sm"
                color="neutral"
                variant="ghost"
                square
                :aria-label="t('apiTokens.regenerate')"
                @click="onRegenerate(token)"
              />
              <UButton
                icon="i-lucide-ban"
                size="sm"
                color="warning"
                variant="ghost"
                square
                :aria-label="t('apiTokens.revokeToken')"
                @click="onRevoke(token)"
              />
            </template>
            <template v-else>
              <UButton
                icon="i-lucide-trash-2"
                size="sm"
                color="error"
                variant="ghost"
                square
                :aria-label="t('apiTokens.deleteToken')"
                @click="onDeleteToken(token)"
              />
            </template>
          </div>
        </div>
      </UCard>
    </div>

    <ApiTokenModal
      :open="modalOpen"
      :token="editingToken ?? undefined"
      :saving="saving"
      @update:open="modalOpen = $event"
      @submit="onSubmit"
    />

    <ApiTokenRevealModal
      :open="revealOpen"
      :token="revealedToken"
      @update:open="revealOpen = $event"
      @dismissed="onRevealDismissed"
    />
  </div>
</template>
