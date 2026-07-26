import { useAuthStore } from "~/stores/auth";

const MESSAGE_PAGE = 10;
const TYPING_SIGNAL_MS = 2_000;
const TYPING_EXPIRY_MS = 5_000;

export function useTicketThread(ticketId: Ref<number>) {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const { isRoot, hasGlobal } = usePermissions();
  const toast = useToast();
  const auth = useAuthStore();
  const { focused } = useWindowFocus();

  const sending = ref(false);
  const typingBy = ref<{ userId: string; who: string } | null>(null);
  const busy = ref(false);
  const loadingOlder = ref(false);
  const older = ref<TicketMessage[]>([]);
  let typingTimer: ReturnType<typeof setTimeout> | null = null;

  const {
    data: fetched,
    status,
    error,
    refresh,
  } = useAsyncData<TicketDetail | null>("ticket-detail", () => call<TicketDetail>(`/tickets/${ticketId.value}`), {
    server: false,
    watch: [ticketId],
  });

  // A ticket outside the caller's reach 404s at the API and the fetch rejects.
  // Surfacing it as a real error page instead of a blank screen matches how the
  // rest of the app reports an inaccessible route.
  watch(error, (e) => {
    if (!e) return;
    // The body the API sends carries the true status; ofetch's own fields are
    // the fallback when there is no structured body to read.
    const shaped = e as { data?: { statusCode?: number }; statusCode?: number; response?: { status?: number } };
    const status = shaped.data?.statusCode ?? shaped.statusCode ?? shaped.response?.status ?? 500;
    showError({ statusCode: status });
  });

  // Subscribing also tells the server this account is reading the thread, which
  // pauses its support notifications for this very ticket.
  const topic = computed(() => (ticketId.value ? `ticket:${ticketId.value}` : null));
  const pushed = useRealtimeTopic<TicketDetail>(topic);
  const typingSignal = useRealtimeTopic<{ userId: string; who: string; at: number }>(() =>
    topic.value ? `${topic.value}#typing` : null
  );
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

  // Whether the message was read by someone other than its own author, which is
  // what the double check reports.
  function seenBy(message: TicketMessage) {
    return (ticket.value?.readers ?? []).filter((r) => r.accountId !== message.authorId && r.lastReadMessageId >= message.id);
  }

  function isMine(message: TicketMessage) {
    return !!auth.session?.accountId && message.authorId === auth.session.accountId;
  }

  // The author may rework their own message for an hour after writing it; the API
  // enforces the same window, this only decides whether to offer the pencil.
  const EDIT_WINDOW_MS = 60 * 60 * 1000;
  function canEditMessage(message: TicketMessage) {
    return isMine(message) && !isClosed.value && Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;
  }

  async function editMessage(messageId: number, body: string) {
    const text = body.trim();
    if (!text) return false;
    try {
      await call(`/tickets/${ticketId.value}/messages/${messageId}`, { method: "PATCH", body: { body: text } });
      await refresh();
      toast.add({ title: t("tickets.toast.edited"), color: "success", icon: "i-lucide-check" });
      return true;
    } catch (e) {
      toast.add({ title: apiErrorMessage(e), color: "error", icon: "i-lucide-triangle-alert" });
      return false;
    }
  }

  async function loadOlder() {
    if (loadingOlder.value || !hasOlder.value) return;
    loadingOlder.value = true;
    try {
      const page = await call<{ items: TicketMessage[]; total: number }>(
        `/tickets/${ticketId.value}/messages?offset=${messages.value.length}&limit=${MESSAGE_PAGE}`
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

  // Reading is signalled from the client rather than inferred from the socket,
  // and having the tab open is not reading it: a thread left in a background
  // window would mark every incoming message as seen while nobody is looking.
  // The receipt therefore waits for the window to actually hold focus.
  const markRead = () => call(`/tickets/${ticketId.value}/read`, { method: "POST" }).catch(() => undefined);

  const notifyTyping = useThrottleFn(() => {
    if (topic.value) realtimeSend("typing", { topic: topic.value });
  }, TYPING_SIGNAL_MS);

  watch(ticketId, () => {
    older.value = [];
    typingBy.value = null;
  });

  // The peer stops sending as soon as they stop typing, so the notice expires on
  // its own instead of waiting for a "stopped" signal that a lost socket would
  // never deliver.
  watch(typingSignal, (signal) => {
    if (!signal || signal.userId === auth.session?.accountId) return;
    typingBy.value = { userId: signal.userId, who: signal.who };
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      typingBy.value = null;
    }, TYPING_EXPIRY_MS);
  });

  watch(
    [() => ticket.value?.messages.at(-1)?.id, focused],
    ([id, hasFocus]) => {
      if (id && hasFocus) markRead();
    },
    { immediate: true }
  );

  onScopeDispose(() => {
    if (typingTimer) clearTimeout(typingTimer);
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
    canEditMessage,
    editMessage,
    seenBy,
    typingBy,
    notifyTyping,
    loadOlder,
    send,
    take,
    changeStatus,
  };
}
