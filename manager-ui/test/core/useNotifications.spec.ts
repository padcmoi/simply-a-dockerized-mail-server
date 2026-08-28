import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { setActivePinia, createPinia, defineStore } from "pinia";
import { useAuthStore } from "~/stores/auth";

vi.stubGlobal("defineStore", defineStore);
const { useNotifications, useNotificationPreferences } = await import("~/composables/useNotifications");

let call: ReturnType<typeof vi.fn>;
let subscribed: string | null;
let pushed: ReturnType<typeof ref<unknown>>;

function feed(over: Record<string, unknown> = {}) {
  return { unread: 0, items: [], ...over };
}

beforeEach(() => {
  setActivePinia(createPinia());
  call = vi.fn().mockResolvedValue(feed());
  subscribed = null;
  pushed = ref(null);
  const states = new Map<string, ReturnType<typeof ref>>();
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useDataRefresh", () => ({ tick: ref(0), bump: vi.fn() }));
  vi.stubGlobal("useState", (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(init()));
    return states.get(key)!;
  });
  vi.stubGlobal("useRealtimeTopic", (topic: () => string | null) => {
    subscribed = topic();
    return computed(() => pushed.value);
  });
});

function signIn(accountId?: string) {
  useAuthStore().session = {
    accountId,
    accessToken: "at",
    refreshToken: "rt",
    expiresAt: "x",
    email: "me@example.com",
  };
}

describe("useNotifications realtime subscription", () => {
  it("subscribes to the topic keyed by the signed-in account", () => {
    signIn("acc-1");
    useNotifications();
    expect(subscribed).toBe("notifications:acc-1");
  });

  it("holds no subscription while the account id is unknown", () => {
    signIn(undefined);
    useNotifications();
    expect(subscribed).toBeNull();
  });

  it("holds no subscription when signed out", () => {
    useNotifications();
    expect(subscribed).toBeNull();
  });

  it("prefers the pushed value over the fetched one", async () => {
    signIn("acc-1");
    const { unread, refresh } = useNotifications();
    call.mockResolvedValue(feed({ unread: 1 }));
    await refresh();
    expect(unread.value).toBe(1);

    pushed.value = feed({ unread: 7 });
    expect(unread.value).toBe(7);
  });

  it("falls back to the fetched value when nothing was pushed yet", async () => {
    signIn("acc-1");
    const { items, refresh } = useNotifications();
    call.mockResolvedValue(feed({ items: [{ id: 3 }] }));
    await refresh();
    expect(items.value).toEqual([{ id: 3 }]);
  });

  it("re-reads the profile when the stored session predates the account id", async () => {
    signIn(undefined);
    const store = useAuthStore();
    const fetchProfile = vi.spyOn(store, "fetchProfile").mockResolvedValue(undefined);
    const { refresh } = useNotifications();
    await refresh();
    expect(fetchProfile).toHaveBeenCalled();
  });

  it("does not re-read the profile when the account id is already known", async () => {
    signIn("acc-1");
    const store = useAuthStore();
    const fetchProfile = vi.spyOn(store, "fetchProfile").mockResolvedValue(undefined);
    const { refresh } = useNotifications();
    await refresh();
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it("does not call the API when signed out", async () => {
    const { refresh } = useNotifications();
    await refresh();
    expect(call).not.toHaveBeenCalled();
  });
});

describe("useNotifications actions", () => {
  beforeEach(() => signIn("acc-1"));

  it("marks one notification read and adopts the returned feed", async () => {
    const { markRead, unread } = useNotifications();
    call.mockResolvedValue(feed({ unread: 2 }));
    await markRead(9);
    expect(call).toHaveBeenCalledWith("/notifications/9/read", { method: "POST" });
    expect(unread.value).toBe(2);
  });

  it("marks everything read", async () => {
    const { markAllRead } = useNotifications();
    await markAllRead();
    expect(call).toHaveBeenCalledWith("/notifications/read-all", { method: "POST" });
  });

  it("deletes one notification", async () => {
    const { remove } = useNotifications();
    await remove(9);
    expect(call).toHaveBeenCalledWith("/notifications/9", { method: "DELETE" });
  });

  it("marks one notification unread again", async () => {
    const { markUnread } = useNotifications();
    call.mockResolvedValue(feed({ unread: 1 }));
    await markUnread(9);
    expect(call).toHaveBeenCalledWith("/notifications/9/unread", { method: "POST" });
  });

  it("purges the read ones, and the counter follows the feed it answers with", async () => {
    const { purge, unread } = useNotifications();
    call.mockResolvedValue(feed({ unread: 3 }));
    await purge("read");
    expect(call).toHaveBeenCalledWith("/notifications?scope=read", { method: "DELETE" });
    expect(unread.value).toBe(3);
  });

  it("purges everything when asked for all, counter back to zero", async () => {
    const { purge, unread } = useNotifications();
    call.mockResolvedValue(feed({ unread: 0 }));
    await purge("all");
    expect(call).toHaveBeenCalledWith("/notifications?scope=all", { method: "DELETE" });
    expect(unread.value).toBe(0);
  });
});

describe("useNotificationPreferences", () => {
  it("reads the caller's preferences", async () => {
    await useNotificationPreferences().load();
    expect(call).toHaveBeenCalledWith("/notifications/preferences");
  });

  it("sends the source next to both channel flags", async () => {
    await useNotificationPreferences().save("support", { inApp: false, email: true });
    expect(call).toHaveBeenCalledWith("/notifications/preferences", {
      method: "PUT",
      body: { source: "support", inApp: false, email: true },
    });
  });
});
