// Everything the API key console can do to a key: creating one, editing it,
// reading its secret back, and the destructive moves that ask first. The page
// that lists the keys was carrying all of this.

export function useApiTokenActions() {
  const { t } = useI18n();
  const toast = useToast();
  const { tokens, loading, create, update, revoke, deleteToken, abandonToken, regenerate, reveal } = useApiTokens();
  const { isRoot, hasGlobal } = usePermissions();

  const modalOpen = ref(false);
  const revealOpen = ref(false);
  const editingToken = ref<ApiTokenItem | null>(null);
  const revealedToken = ref<CreatedToken | null>(null);
  const revealMode = ref<"created" | "stored">("created");
  const revealingId = ref<number | null>(null);
  const saving = ref(false);
  const confirmOpen = ref(false);
  const pending = ref<{ type: "danger" | "warning"; title: string; description: string; run: () => Promise<void> } | null>(null);

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

  return {
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
  };
}
