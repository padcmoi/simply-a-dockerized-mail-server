import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed, nextTick } from "vue";
import { setActivePinia, createPinia, defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";

vi.stubGlobal("defineStore", defineStore);
const { useTicketThread } = await import("~/composables/useTicketThread");

const ME = "me-id";
const PEER = "peer-id";

let call: ReturnType<typeof vi.fn>;
let sent: { event: string; data: unknown }[];
let thread: ReturnType<typeof ref<unknown>>;
let typing: ReturnType<typeof ref<unknown>>;
let focused: ReturnType<typeof ref<boolean>>;
let fetchError: ReturnType<typeof ref<unknown>>;
let shown: unknown[];

function message(over: Record<string, unknown> = {}) {
  return { id: 1, authorId: PEER, authorEmail: "peer@x.io", authorName: null, authorAvatarUrl: null, body: "hi", createdAt: "2026-07-22T10:00:00Z", ...over };
}

function detail(over: Record<string, unknown> = {}) {
  return { id: 4, status: "open", createdBy: PEER, messages: [message()], messagesTotal: 1, readers: [], ...over };
}

beforeEach(() => {
  setActivePinia(createPinia());
  call = vi.fn().mockResolvedValue(detail());
  sent = [];
  thread = ref(null);
  typing = ref(null);
  focused = ref(true);
  fetchError = ref(null);
  shown = [];
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useApiError", () => ({ apiErrorMessage: (e: unknown) => String(e) }));
  vi.stubGlobal("usePermissions", () => ({ isRoot: computed(() => false), hasGlobal: () => false }));
  vi.stubGlobal("useToast", () => ({ add: vi.fn() }));
  vi.stubGlobal("useWindowFocus", () => ({ focused, checkCurrentRoute: vi.fn() }));
  vi.stubGlobal("useI18n", () => ({ t: (k: string) => k }));
  vi.stubGlobal("useAsyncData", (_key: string, _fn: unknown) => ({
    data: thread,
    status: ref("success"),
    error: fetchError,
    refresh: vi.fn(),
  }));
  vi.stubGlobal("showError", (e: unknown) => shown.push(e));
  // The composable passes a computed for the thread and a getter for the typing
  // topic, so resolve both shapes.
  vi.stubGlobal("useRealtimeTopic", (topic: (() => string | null) | { value: string | null }) => {
    const resolved = typeof topic === "function" ? topic() : topic.value;
    return computed(() => (resolved?.endsWith("#typing") ? typing.value : null));
  });
  vi.stubGlobal("realtimeSend", (event: string, data: unknown) => sent.push({ event, data }));
  vi.stubGlobal("useThrottleFn", (fn: () => void) => fn);
  useAuthStore().session = { accountId: ME, accessToken: "at", refreshToken: "rt", expiresAt: "x", email: "me@x.io" };
});

describe("typing signal", () => {
  it("emits on the thread topic when asked", () => {
    const { notifyTyping } = useTicketThread(ref(4));
    notifyTyping();
    expect(sent).toEqual([{ event: "typing", data: { topic: "ticket:4" } }]);
  });

  it("surfaces a peer typing", async () => {
    const { typingBy } = useTicketThread(ref(4));
    typing.value = { userId: PEER, who: "peer@x.io", at: 1 };
    await nextTick();
    expect(typingBy.value).toEqual({ userId: PEER, who: "peer@x.io" });
  });

  // The signal fans out to everyone but the sender server-side; this guards the
  // case of a second tab of the same account echoing it back.
  it("ignores a signal coming from the account itself", async () => {
    const { typingBy } = useTicketThread(ref(4));
    typing.value = { userId: ME, who: "me@x.io", at: 1 };
    await nextTick();
    expect(typingBy.value).toBeNull();
  });
});

describe("fetch error surfacing", () => {
  it("raises a 404 page when the ticket is out of reach", async () => {
    useTicketThread(ref(18));
    fetchError.value = { statusCode: 404 };
    await nextTick();
    expect(shown).toEqual([{ statusCode: 404 }]);
  });

  it("raises a 403 page when access is refused", async () => {
    useTicketThread(ref(18));
    fetchError.value = { response: { status: 403 } };
    await nextTick();
    expect(shown).toEqual([{ statusCode: 403 }]);
  });

  it("falls back to 500 on an unshaped error", async () => {
    useTicketThread(ref(18));
    fetchError.value = new Error("boom");
    await nextTick();
    expect(shown).toEqual([{ statusCode: 500 }]);
  });

  it("does nothing while the fetch is fine", () => {
    useTicketThread(ref(4));
    expect(shown).toEqual([]);
  });
});

describe("read receipts", () => {
  it("marks the thread read when it carries a message", async () => {
    thread.value = detail();
    useTicketThread(ref(4));
    await nextTick();
    expect(call).toHaveBeenCalledWith("/tickets/4/read", { method: "POST" });
  });

  // An open tab is not a reader: a thread left in a background window would
  // otherwise mark every incoming message as seen while nobody is looking.
  it("does not mark anything read while the window has no focus", async () => {
    focused.value = false;
    thread.value = detail();
    useTicketThread(ref(4));
    await nextTick();
    expect(call).not.toHaveBeenCalledWith("/tickets/4/read", { method: "POST" });
  });

  it("marks read as soon as the window regains focus", async () => {
    focused.value = false;
    thread.value = detail();
    useTicketThread(ref(4));
    await nextTick();
    focused.value = true;
    await nextTick();
    expect(call).toHaveBeenCalledWith("/tickets/4/read", { method: "POST" });
  });

  it("reports a message as unseen while nobody read that far", () => {
    thread.value = detail({ readers: [{ accountId: PEER, lastReadMessageId: 0, name: null, avatarUrl: null, readAt: "" }] });
    const { seenBy } = useTicketThread(ref(4));
    expect(seenBy(message({ id: 5, authorId: ME }))).toEqual([]);
  });

  it("reports a message as seen once someone read past it", () => {
    thread.value = detail({ readers: [{ accountId: PEER, lastReadMessageId: 7, name: "Peer", avatarUrl: null, readAt: "" }] });
    const { seenBy } = useTicketThread(ref(4));
    expect(seenBy(message({ id: 5, authorId: ME }))).toHaveLength(1);
  });

  // Reading one's own message is not a receipt, otherwise every message would
  // show as read the instant it is sent.
  it("never counts the author's own receipt", () => {
    thread.value = detail({ readers: [{ accountId: ME, lastReadMessageId: 9, name: "Me", avatarUrl: null, readAt: "" }] });
    const { seenBy } = useTicketThread(ref(4));
    expect(seenBy(message({ id: 5, authorId: ME }))).toEqual([]);
  });
});
