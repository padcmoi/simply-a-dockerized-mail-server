import { useRealtimeData } from "~/composables/useRealtime";
import { useAuthStore } from "~/stores/auth";

// Mirrors the API's own list, whose `GET /notifications/preferences` answers
// with every source and the defaults it applies to each: the page reads its rows
// from that answer, so this is a type and never a second catalogue.
export const NOTIFICATION_SOURCES = ["support", "supervision"] as const;

const EMPTY: NotificationFeed = { unread: 0, items: [] };

export function useNotifications() {
  const auth = useAuthStore();
  const { call } = useApi();
  const { tick } = useDataRefresh();

  const accountId = computed(() => auth.session?.accountId ?? null);
  const topic = computed(() => (accountId.value ? `notifications:${accountId.value}` : null));
  const pushed = useRealtimeTopic<NotificationFeed>(() => topic.value);
  const fetched = useState<NotificationFeed>("notifications-feed", () => ({ ...EMPTY }));
  const realtime = useRealtimeData();

  const feed = computed<NotificationFeed>(() => pushed.value ?? fetched.value);
  const unread = computed(() => feed.value.unread);
  const items = computed(() => feed.value.items);

  // A write is in flight. Shared like the feed itself, since the bell and the
  // history page are two views of the same one: whichever asked, both know not
  // to ask again until the answer lands.
  const writing = useState("notifications-writing", () => false);

  // What the bell shows is the PUSHED feed whenever there is one, so a write
  // answering with the new feed was invisible: the counter only moved when the
  // socket got round to saying the same thing, a second or two later, and the
  // whole interface stood still until then. A local answer lands in both.
  function publish(next: NotificationFeed) {
    fetched.value = next;
    if (topic.value) realtime.value = { ...realtime.value, [topic.value]: next };
  }

  // Every write answers with the whole feed, so one shape covers them all.
  // `expected` is what the answer will say, applied at once: the read marks, the
  // counter and the button that depends on it follow the click instead of the
  // round trip, and there is nothing left to click twice. The request is still
  // the truth -- its answer overwrites, and a failure puts back what was there.
  async function write(request: () => Promise<NotificationFeed>, expected?: (_current: NotificationFeed) => NotificationFeed) {
    if (writing.value) return;
    const before = feed.value;
    if (expected) publish(expected(before));
    writing.value = true;
    try {
      publish(await request());
    } catch (err) {
      publish(before);
      throw err;
    } finally {
      writing.value = false;
    }
  }

  const readNow = (row: NotificationRow) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() });

  // A session restored from storage before the account id was exposed carries no
  // accountId, so the realtime topic can never be built: re-read the profile once
  // instead of leaving the bell on the REST fallback for the whole session.
  async function refresh() {
    if (!auth.isAuthenticated) return;
    if (!accountId.value) await auth.fetchProfile().catch(() => undefined);
    publish(await call<NotificationFeed>("/notifications/feed"));
  }

  function markRead(id: number) {
    return write(
      () => call<NotificationFeed>(`/notifications/${id}/read`, { method: "POST" }),
      (current) => ({
        unread: Math.max(0, current.unread - (current.items.find((row) => row.id === id)?.readAt ? 0 : 1)),
        items: current.items.map((row) => (row.id === id ? readNow(row) : row)),
      })
    );
  }

  function markAllRead() {
    return write(
      () => call<NotificationFeed>("/notifications/read-all", { method: "POST" }),
      (current) => ({ unread: 0, items: current.items.map(readNow) })
    );
  }

  function markUnread(id: number) {
    return write(() => call<NotificationFeed>(`/notifications/${id}/unread`, { method: "POST" }));
  }

  function remove(id: number) {
    return write(() => call<NotificationFeed>(`/notifications/${id}`, { method: "DELETE" }));
  }

  // Every write route answers with the feed, so the bell's counter follows a
  // purge without a second call and without waiting for the realtime push.
  function purge(scope: "all" | "read") {
    return write(() => call<NotificationFeed>(`/notifications?scope=${scope}`, { method: "DELETE" }));
  }

  const safeRefresh = () => refresh().catch(() => undefined);

  watch(
    () => auth.isAuthenticated,
    (ok) => ok && safeRefresh()
  );
  watch(tick, safeRefresh);

  return { feed, unread, items, writing, refresh, markRead, markUnread, markAllRead, remove, purge };
}

export function useNotificationPreferences() {
  const { call } = useApi();

  function load() {
    return call<NotificationPreferences>("/notifications/preferences");
  }

  function save(source: NotificationSource, channels: NotificationChannels) {
    return call<NotificationPreferences>("/notifications/preferences", {
      method: "PUT",
      body: { source, ...channels },
    });
  }

  return { load, save };
}
