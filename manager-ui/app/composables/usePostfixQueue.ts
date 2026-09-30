export const QUEUE_NAMES: QueueName[] = ["active", "deferred", "hold", "incoming"];

export function usePostfixQueue() {
  const { call } = useApi();
  const route = useRoute();
  const router = useRouter();

  const stats = ref<PostfixQueueStats | null>(null);
  const listing = ref<PostfixQueueMessages | null>(null);
  const loadingMessages = ref(false);

  const queue = computed<QueueName>({
    get: () => {
      const wanted = route.query.queue;
      return QUEUE_NAMES.find((name) => name === wanted) ?? "active";
    },
    set: (value) => {
      router.replace({ query: { ...route.query, queue: value } });
    },
  });

  const realtimeStats = useRealtimeTopic<PostfixQueueStats>("postfix-queue");
  watch(realtimeStats, (value) => {
    if (value) stats.value = value;
  });

  const realtimeMessages = useRealtimeTopic<PostfixQueueMessages>(() => `postfix-queue-messages:${queue.value}`);
  watch(realtimeMessages, (value) => {
    if (value && value.queue === queue.value) listing.value = value;
  });

  async function loadStats() {
    stats.value = await call<PostfixQueueStats>("/postfix/queue");
  }

  async function loadMessages() {
    const wanted = queue.value;
    loadingMessages.value = true;
    try {
      const data = await call<PostfixQueueMessages>(`/postfix/queue/${wanted}/messages`);
      if (wanted === queue.value) listing.value = data;
    } finally {
      loadingMessages.value = false;
    }
  }

  watch(queue, () => {
    listing.value = null;
    loadMessages();
  });
  watch(useDataRefresh().tick, () => {
    loadStats();
    loadMessages();
  });

  return { stats, listing, queue, loadingMessages, loadStats, loadMessages };
}
