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
  const pushed = useRealtimeTopic<NotificationFeed>(() => (accountId.value ? `notifications:${accountId.value}` : null));
  const fetched = useState<NotificationFeed>("notifications-feed", () => ({ ...EMPTY }));

  const feed = computed<NotificationFeed>(() => pushed.value ?? fetched.value);
  const unread = computed(() => feed.value.unread);
  const items = computed(() => feed.value.items);

  // A session restored from storage before the account id was exposed carries no
  // accountId, so the realtime topic can never be built: re-read the profile once
  // instead of leaving the bell on the REST fallback for the whole session.
  async function refresh() {
    if (!auth.isAuthenticated) return;
    if (!accountId.value) await auth.fetchProfile().catch(() => undefined);
    fetched.value = await call<NotificationFeed>("/notifications/feed");
  }

  async function markRead(id: number) {
    fetched.value = await call<NotificationFeed>(`/notifications/${id}/read`, { method: "POST" });
  }

  async function markAllRead() {
    fetched.value = await call<NotificationFeed>("/notifications/read-all", { method: "POST" });
  }

  async function markUnread(id: number) {
    fetched.value = await call<NotificationFeed>(`/notifications/${id}/unread`, { method: "POST" });
  }

  async function remove(id: number) {
    fetched.value = await call<NotificationFeed>(`/notifications/${id}`, { method: "DELETE" });
  }

  // Every write route answers with the feed, so the bell's counter follows a
  // purge without a second call and without waiting for the realtime push.
  async function purge(scope: "all" | "read") {
    fetched.value = await call<NotificationFeed>(`/notifications?scope=${scope}`, { method: "DELETE" });
  }

  const safeRefresh = () => refresh().catch(() => undefined);

  watch(
    () => auth.isAuthenticated,
    (ok) => ok && safeRefresh()
  );
  watch(tick, safeRefresh);

  return { feed, unread, items, refresh, markRead, markUnread, markAllRead, remove, purge };
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
