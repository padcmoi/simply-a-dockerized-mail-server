<script setup lang="ts">
import type { ApiTokenItem, CreatedToken } from "~/composables/useApiTokens";

definePageMeta({
  requiredGlobal: [
    { resource: "api-tokens", action: "access" },
    { resource: "api-tokens", action: "list-api-tokens" },
  ],
});

const modalOpen = ref(false);
const revealOpen = ref(false);
const editingToken = ref<ApiTokenItem | null>(null);
const revealedToken = ref<CreatedToken | null>(null);
const revealMode = ref<"created" | "stored">("created");
const revealingId = ref<number | null>(null);
const saving = ref(false);
const confirmOpen = ref(false);
const pending = ref<{ type: "danger" | "warning"; title: string; description: string; run: () => Promise<void> } | null>(null);

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const toast = useToast();
setBreadcrumb([{ label: t("nav.apiTokens") }]);

const { tokens, loading, create, update, revoke, deleteToken, abandonToken, regenerate, reveal } = useApiTokens();
const { isRoot, hasGlobal } = usePermissions();
const canReveal = computed(() => isRoot.value || hasGlobal("api-tokens", "regenerate-api-token"));

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
      revealMode.value = "created";
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

function ask(action: { type: "danger" | "warning"; title: string; description: string; run: () => Promise<void> }) {
  pending.value = action;
  confirmOpen.value = true;
}

async function onConfirmed() {
  const action = pending.value;
  pending.value = null;
  await action?.run();
}

function askRevoke(token: ApiTokenItem) {
  ask({
    type: "danger",
    title: t("apiTokens.confirm.revokeTitle"),
    description: t("apiTokens.confirm.revokeDescription", { name: token.name }),
    run: () => onRevoke(token),
  });
}

function askDelete(token: ApiTokenItem) {
  ask({
    type: "danger",
    title: t("apiTokens.confirm.deleteTitle"),
    description: t("apiTokens.confirm.deleteDescription", { name: token.name }),
    run: () => onDeleteToken(token),
  });
}

function askRegenerate(token: ApiTokenItem) {
  ask({
    type: "warning",
    title: t("apiTokens.confirm.regenerateTitle"),
    description: t("apiTokens.confirm.regenerateDescription", { name: token.name }),
    run: () => onRegenerate(token),
  });
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

async function onReveal(token: ApiTokenItem) {
  revealingId.value = token.id;
  try {
    const revealed = await reveal(token.id);
    if (!revealed.key) {
      toast.add({
        title: t("apiTokens.secret.unavailable"),
        description: t("apiTokens.secret.unavailableHint"),
        color: "warning",
      });
      return;
    }
    revealMode.value = "stored";
    revealedToken.value = {
      id: revealed.id,
      name: revealed.name,
      clientId: revealed.clientId,
      key: revealed.key,
      allowedIps: token.allowedIps,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    };
    revealOpen.value = true;
  } catch (e) {
    toast.add({ title: t("apiTokens.secret.revealFailed"), description: (e as Error).message, color: "error" });
  } finally {
    revealingId.value = null;
  }
}

async function onRegenerate(token: ApiTokenItem) {
  try {
    const created = await regenerate(token.id);
    revealMode.value = "created";
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
