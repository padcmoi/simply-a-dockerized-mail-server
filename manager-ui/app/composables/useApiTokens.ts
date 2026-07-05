export interface ApiTokenItem {
  id: number;
  name: string;
  clientId: string;
  allowedIps: string[] | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
}

export interface CreatedToken {
  id: number;
  name: string;
  clientId: string;
  key: string;
  allowedIps: string[] | null;
  expiresAt: string | null;
  createdAt: string;
}

export function useApiTokens() {
  const { call } = useApi();
  const { t } = useI18n();
  const toast = useToast();

  const tokens = ref<ApiTokenItem[]>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      tokens.value = await call<ApiTokenItem[]>("/api-tokens");
    } catch {
      toast.add({ title: t("apiTokens.toast.loadFailed"), color: "error" });
    } finally {
      loading.value = false;
    }
  }

  async function create(input: { name: string; allowedIps?: string[]; expiresAt?: string }) {
    const created = await call<CreatedToken>("/api-tokens", { method: "POST", body: input });
    tokens.value.unshift({
      id: created.id,
      name: created.name,
      clientId: created.clientId,
      allowedIps: created.allowedIps,
      expiresAt: created.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      createdAt: created.createdAt,
    });
    return created;
  }

  async function update(id: number, input: { name?: string; allowedIps?: string[] | null; expiresAt?: string | null }) {
    await call(`/api-tokens/${id}`, { method: "PATCH", body: input });
    const token = tokens.value.find((t) => t.id === id);
    if (token) Object.assign(token, input);
  }

  async function revoke(id: number) {
    await call(`/api-tokens/${id}/revoke`, { method: "POST" });
    const token = tokens.value.find((t) => t.id === id);
    if (token) token.revokedAt = new Date().toISOString();
  }

  async function deleteToken(id: number) {
    await call(`/api-tokens/${id}`, { method: "DELETE" });
    tokens.value = tokens.value.filter((t) => t.id !== id);
  }

  async function abandonToken(id: number) {
    await call(`/api-tokens/${id}/revoke`, { method: "POST" });
    await call(`/api-tokens/${id}`, { method: "DELETE" });
    tokens.value = tokens.value.filter((t) => t.id !== id);
  }

  async function regenerate(id: number) {
    const created = await call<CreatedToken>(`/api-tokens/${id}/regenerate`, { method: "POST" });
    const token = tokens.value.find((t) => t.id === id);
    if (token) token.clientId = created.clientId;
    return created;
  }

  watch(useDataRefresh().tick, load);
  onMounted(load);

  return { tokens, loading, load, create, update, revoke, deleteToken, abandonToken, regenerate };
}
