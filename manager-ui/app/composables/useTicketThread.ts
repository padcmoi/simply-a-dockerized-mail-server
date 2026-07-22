import { useAuthStore } from "~/stores/auth";

export function useTicketThread(ticketId: Ref<number>) {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const { isRoot, hasGlobal } = usePermissions();
  const toast = useToast();
  const auth = useAuthStore();

  const sending = ref(false);
  const busy = ref(false);
  const loadingOlder = ref(false);
  const older = ref<TicketMessage[]>([]);

  const {
    data: fetched,
    status,
    refresh,
  } = useAsyncData<TicketDetail | null>("ticket-detail", () => call<TicketDetail>(`/tickets/${ticketId.value}`), {
    server: false,
    watch: [ticketId],
  });

  // Subscribing also tells the server this account is reading the thread, which
  // pauses its support notifications for this very ticket.
  const pushed = useRealtimeTopic<TicketDetail>(() => (ticketId.value ? `ticket:${ticketId.value}` : null));
  const ticket = computed<TicketDetail | null>(() => pushed.value ?? fetched.value ?? null);

  const loading = computed(() => !ticket.value && status.value !== "error");
  const canHandle = computed(() => isRoot.value || hasGlobal("tickets", "handle-ticket"));
  const isAuthor = computed(() => !!auth.session?.accountId && ticket.value?.createdBy === auth.session.accountId);
  const isClosed = computed(() => ticket.value?.status === "closed");
  // The author always answers their own thread; anyone else needs the action.
  const canReply = computed(() => !isClosed.value && (isAuthor.value || isRoot.value || hasGlobal("tickets", "reply-ticket")));
  const canTake = computed(() => canHandle.value && !isAuthor.value && !ticket.value?.assignedTo);

  // The live page never overlaps the pages already pulled above it, so the two
  // just concatenate: older ones are only fetched from the current page's top.
  const messages = computed<TicketMessage[]>(() => [...older.value, ...(ticket.value?.messages ?? [])]);
  const total = computed(() => ticket.value?.messagesTotal ?? 0);
  const hasOlder = computed(() => messages.value.length < total.value);

  function isMine(message: TicketMessage) {
    return !!auth.session?.accountId && message.authorId === auth.session.accountId;
  }

  async function loadOlder() {
    if (loadingOlder.value || !hasOlder.value) return;
    loadingOlder.value = true;
    try {
      const page = await call<{ items: TicketMessage[]; total: number }>(
        `/tickets/${ticketId.value}/messages?offset=${messages.value.length}&limit=10`
      );
      older.value = [...page.items, ...older.value];
    } catch (e) {
      toast.add({ title: apiErrorMessage(e), color: "error", icon: "i-lucide-triangle-alert" });
    } finally {
      loadingOlder.value = false;
    }
  }

  async function send(body: string) {
    const text = body.trim();
    if (!text) return false;
    sending.value = true;
    try {
      await call(`/tickets/${ticketId.value}/messages`, { method: "POST", body: { body: text } });
      await refresh();
      return true;
    } catch (e) {
      toast.add({ title: apiErrorMessage(e), color: "error", icon: "i-lucide-triangle-alert" });
      return false;
    } finally {
      sending.value = false;
    }
  }

  async function act(run: () => Promise<unknown>, success: string) {
    busy.value = true;
    try {
      await run();
      await refresh();
      toast.add({ title: success, color: "success", icon: "i-lucide-check" });
    } catch (e) {
      toast.add({ title: apiErrorMessage(e), color: "error", icon: "i-lucide-triangle-alert" });
    } finally {
      busy.value = false;
    }
  }

  const take = () => act(() => call(`/tickets/${ticketId.value}/take`, { method: "POST" }), t("tickets.toast.taken"));

  const changeStatus = (next: string) =>
    act(
      () => call(`/tickets/${ticketId.value}/status`, { method: "PATCH", body: { status: next } }),
      t("tickets.toast.statusChanged")
    );

  watch(ticketId, () => {
    older.value = [];
  });

  return {
    ticket,
    messages,
    total,
    hasOlder,
    loading,
    loadingOlder,
    sending,
    busy,
    canHandle,
    canTake,
    canReply,
    isClosed,
    isAuthor,
    isMine,
    loadOlder,
    send,
    take,
    changeStatus,
  };
}
