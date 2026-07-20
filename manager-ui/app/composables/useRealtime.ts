const subscribers = reactive(new Map<string, Set<symbol>>());

export function useRealtimeActiveTopics() {
  return computed(() => [...subscribers.entries()].filter(([, ids]) => ids.size > 0).map(([topic]) => topic));
}

export function useRealtimeData() {
  return useState<Record<string, unknown>>("realtime-data", () => ({}));
}

function addSub(topic: string, id: symbol) {
  subscribers.set(topic, new Set(subscribers.get(topic)).add(id));
}

function removeSub(topic: string, id: symbol) {
  const ids = new Set(subscribers.get(topic));
  ids.delete(id);
  subscribers.set(topic, ids);
}

// Subscribe to a realtime topic and read its latest pushed value. The topic may
// be a plain string (static topic) or a ref/getter that resolves to a topic
// string, null or undefined (parameterized topics whose id is resolved async):
// the subscription follows the resolved value, re-subscribing when it changes
// and holding no subscription while it is null.
export function useRealtimeTopic<T>(topic: MaybeRefOrGetter<string | null | undefined>) {
  const store = useRealtimeData();
  const current = computed(() => toValue(topic) ?? null);

  if (import.meta.client) {
    const id = Symbol("realtime");
    let active: string | null = null;
    watch(
      current,
      (next) => {
        if (next === active) return;
        if (active) removeSub(active, id);
        active = next;
        if (next) addSub(next, id);
      },
      { immediate: true }
    );
    onScopeDispose(() => {
      if (active) removeSub(active, id);
    });
  }

  return computed(() => (current.value ? ((store.value[current.value] ?? null) as T | null) : null));
}
