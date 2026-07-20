const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  const topics = useRealtimeActiveTopics();
  const store = useRealtimeData();

  let socket: WebSocket | null = null;
  let reconnectDelay = RECONNECT_BASE_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let sent = new Set<string>();

  function send(event: string, data: unknown) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event, data }));
  }

  function syncTopics() {
    if (socket?.readyState !== WebSocket.OPEN) return;
    for (const topic of topics.value) {
      if (!sent.has(topic)) send("subscribe", { topic });
    }
    for (const topic of sent) {
      if (!topics.value.includes(topic)) send("unsubscribe", { topic });
    }
    sent = new Set(topics.value);
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  function connect() {
    if (stopped || !auth.session || socket) return;
    sent = new Set();
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}/realtime`);

    socket.addEventListener("open", () => {
      reconnectDelay = RECONNECT_BASE_MS;
      send("auth", { token: auth.session?.accessToken });
      syncTopics();
    });
    socket.addEventListener("message", (raw) => {
      try {
        const { topic, data } = JSON.parse(raw.data);
        if (topic) store.value = { ...store.value, [topic]: data };
      } catch {
        // best effort
      }
    });
    socket.addEventListener("close", () => {
      socket = null;
      sent = new Set();
      if (!stopped && auth.session) scheduleReconnect();
    });
    socket.addEventListener("error", () => socket?.close());
  }

  function disconnect() {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
  }

  watch(topics, syncTopics);

  watch(
    () => auth.isAuthenticated,
    (authenticated) => {
      stopped = false;
      if (authenticated) connect();
      else disconnect();
    },
    { immediate: true }
  );
});
