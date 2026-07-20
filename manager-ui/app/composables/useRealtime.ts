const subscribers = reactive(new Map<string, Set<symbol>>());

export function useRealtimeActiveTopics() {
  return computed(() => [...subscribers.entries()].filter(([, ids]) => ids.size > 0).map(([topic]) => topic));
}

export function useRealtimeData() {
  return useState<Record<string, unknown>>("realtime-data", () => ({}));
}

export function useRealtimeTopic<T>(topic: string) {
  const store = useRealtimeData();

  if (import.meta.client) {
    const id = Symbol(topic);
    subscribers.set(topic, new Set(subscribers.get(topic)).add(id));

    onScopeDispose(() => {
      const ids = new Set(subscribers.get(topic));
      ids.delete(id);
      subscribers.set(topic, ids);
    });
  }

  return computed(() => (store.value[topic] ?? null) as T | null);
}
