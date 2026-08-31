// Inline edit state for a ticket message bubble: which message is open in the
// editor, its draft, the save round-trip, and a live countdown of the one-hour
// window (from the message's creation) left to edit it. The actual PATCH lives
// in useTicketThread and is passed in; this only owns the editor UI state.
const EDIT_WINDOW_MS = 60 * 60 * 1000;

export function useTicketMessageEdit(save: (id: number, body: string) => Promise<boolean>) {
  const editingId = ref<number | null>(null);
  const editDraft = ref("");
  const savingEdit = ref(false);
  const createdAtMs = ref<number | null>(null);
  const now = ref(Date.now());
  let ticker: ReturnType<typeof setInterval> | null = null;

  const remainingMs = computed(() =>
    createdAtMs.value === null ? 0 : Math.max(0, createdAtMs.value + EDIT_WINDOW_MS - now.value)
  );
  const expired = computed(() => remainingMs.value <= 0);
  const remainingLabel = computed(() => {
    const total = Math.floor(remainingMs.value / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  });

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  function startEdit(message: { id: number; body: string; createdAt: string }) {
    editingId.value = message.id;
    editDraft.value = message.body;
    createdAtMs.value = new Date(message.createdAt).getTime();
    now.value = Date.now();
    stopTicker();
    ticker = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  }

  function cancelEdit() {
    editingId.value = null;
    editDraft.value = "";
    createdAtMs.value = null;
    stopTicker();
  }

  async function saveEdit(id: number) {
    const text = editDraft.value.trim();
    if (!text || savingEdit.value || expired.value) return;
    savingEdit.value = true;
    const ok = await save(id, text);
    savingEdit.value = false;
    if (ok) cancelEdit();
  }

  onScopeDispose(stopTicker);

  return { editingId, editDraft, savingEdit, remainingLabel, expired, startEdit, cancelEdit, saveEdit };
}
