import { NOTIFICATION_SOURCES } from "~/composables/useNotifications";

// The whole history of an account's notifications: the two filters that live in
// the URL, the paged list behind them, and every write that can be made from a
// row. The page that shows it was carrying all of this itself.

const ALL = "all";

export function useNotificationHistory() {
  const route = useRoute();
  const { t } = useI18n();
  const toast = useToast();
  const { unread, feed, markRead, markUnread, markAllRead, remove, purge, refresh: refreshFeed } = useNotifications();
  const { bump } = useDataRefresh();

  // Both filters are read from the URL and written back to it, so a reload, a
  // bookmark or a link from elsewhere opens the list that was being looked at.
  const readFilter = ref<"all" | "read" | "unread">(
    route.query.read === "read" || route.query.read === "unread" ? route.query.read : "all"
  );
  const sourceFilter = ref<string>(
    NOTIFICATION_SOURCES.includes(route.query.source as (typeof NOTIFICATION_SOURCES)[number]) ? String(route.query.source) : ALL
  );
  const busyId = ref<number | null>(null);
  // Every local write reloads the list itself; without this the feed watcher
  // below would answer the same write with a second identical fetch.
  const writing = ref(false);

  const list = usePaginatedList<NotificationRow>(
    "notifications-history",
    "/notifications",
    "createdAt",
    [readFilter, sourceFilter],
    () => ({
      ...(readFilter.value === "all" ? {} : { read: readFilter.value }),
      ...(sourceFilter.value === ALL ? {} : { source: sourceFilter.value }),
    })
  );
  const { items, total, loading, page, search, load } = list;

  const filtering = computed(() => readFilter.value !== "all" || sourceFilter.value !== ALL || search.value.length > 0);

  watch([readFilter, sourceFilter], ([read, source]) => {
    page.value = 1;
    const query: Record<string, string> = {};
    if (read !== "all") query.read = read;
    if (source !== ALL) query.source = source;
    navigateTo({ query }, { replace: true });
  });

  // A notification arriving by websocket while the page is open must land in the
  // table too, not only in the bell: what is watched is the feed the socket
  // pushes, and the guard keeps a local write from fetching twice.
  watch(
    () => feed.value.items[0]?.id ?? 0,
    (newest, previous) => {
      // `previous === 0` is the feed arriving for the first time, next to the
      // list's own first fetch, and not a notification that just came in.
      if (previous === 0 || newest === previous || writing.value) return;
      void load();
    }
  );

  // Deleting or purging the last rows of the last page leaves it beyond the end
  // of a list that still has rows: step back rather than show an empty table
  // under a pager saying otherwise.
  watch([items, total], ([rows, count]) => {
    if (!loading.value && rows.length === 0 && count > 0 && page.value > 1) page.value = 1;
  });

  // Every write reports the same way and reloads the same list, so the row that
  // was acted on shows its new state and the bell's counter follows.
  async function run(action: () => Promise<unknown>, failure: string, rowId: number | null = null) {
    busyId.value = rowId;
    writing.value = true;
    try {
      await action();
      await load();
      bump();
    } catch (e) {
      toast.add({ title: t(failure), description: (e as Error).message, color: "error" });
    } finally {
      busyId.value = null;
      writing.value = false;
    }
  }

  function toggleRead(row: NotificationRow) {
    return run(() => (row.readAt ? markUnread(row.id) : markRead(row.id)), "notifications.history.actionFailed", row.id);
  }

  function deleteRow(row: NotificationRow) {
    return run(() => remove(row.id), "notifications.history.actionFailed", row.id);
  }

  function readEverything() {
    return run(markAllRead, "notifications.history.actionFailed");
  }

  async function purgeScope(scope: "all" | "read") {
    page.value = 1;
    await run(() => purge(scope), "notifications.history.purgeFailed");
    toast.add({ title: t("notifications.history.purged"), color: "success" });
  }

  async function open(row: NotificationRow) {
    if (!row.readAt) await run(() => markRead(row.id), "notifications.history.actionFailed", row.id);
    if (row.link) await navigateTo(row.link);
  }

  onMounted(() => refreshFeed().catch(() => undefined));

  return {
    ...list,
    ALL,
    unread,
    readFilter,
    sourceFilter,
    busyId,
    filtering,
    toggleRead,
    deleteRow,
    readEverything,
    purgeScope,
    open,
  };
}
