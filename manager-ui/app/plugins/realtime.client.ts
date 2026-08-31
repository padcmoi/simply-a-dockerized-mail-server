const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
// A socket can die without a close event (suspended tab, NAT timing out) and
// then deliver nothing while claiming to be open. Pinging turns that silence
// into a fact: no answer within the deadline means the connection is gone.
const PING_EVERY_MS = 25_000;
const SILENCE_LIMIT_MS = 60_000;

export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  const topics = useRealtimeActiveTopics();
  const store = useRealtimeData();

  let socket: WebSocket | null = null;
  let reconnectDelay = RECONNECT_BASE_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let lastFrameAt = 0;
  let stopped = false;
  let sent = new Set<string>();

  function send(event: string, data: unknown) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event, data }));
  }

  registerRealtimeSender(send);

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

  function stopHeartbeat() {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
  }

  function startHeartbeat() {
    stopHeartbeat();
    lastFrameAt = Date.now();
    heartbeat = setInterval(() => {
      if (socket?.readyState !== WebSocket.OPEN) return;
      if (Date.now() - lastFrameAt > SILENCE_LIMIT_MS) {
        socket.close();
        return;
      }
      send("ping", {});
    }, PING_EVERY_MS);
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  // The stored access token may well have expired while the socket was down, and
  // the gateway closes on a stale one: reconnecting without rotating it first
  // would just loop until the user reloads the page by hand.
  async function connect() {
    if (stopped || !auth.session || socket) return;
    const ok = await auth.refreshIfNeeded().catch(() => false);
    if (!ok || stopped || !auth.session || socket) return;

    sent = new Set();
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}/realtime`);

    socket.addEventListener("open", () => {
      reconnectDelay = RECONNECT_BASE_MS;
      send("auth", { token: auth.session?.accessToken });
      syncTopics();
      startHeartbeat();
      emitRealtimeOpen();
    });
    socket.addEventListener("message", (raw) => {
      lastFrameAt = Date.now();
      try {
        const { topic, data } = JSON.parse(raw.data);
        if (topic && topic !== "#pong") store.value = { ...store.value, [topic]: data };
      } catch {
        // best effort
      }
    });
    socket.addEventListener("close", () => {
      socket = null;
      sent = new Set();
      stopHeartbeat();
      if (!stopped && auth.session) scheduleReconnect();
    });
    socket.addEventListener("error", () => socket?.close());
  }

  function disconnect() {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    stopHeartbeat();
    socket?.close();
    socket = null;
  }

  // Coming back to the tab is exactly when a dead connection gets noticed, so it
  // reconnects at once instead of waiting out the backoff.
  function reconnectNow() {
    if (stopped || !auth.session || socket?.readyState === WebSocket.OPEN) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    reconnectDelay = RECONNECT_BASE_MS;
    socket?.close();
    socket = null;
    connect();
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

  useEventListener(window, "online", reconnectNow);
  useEventListener(window, "focus", reconnectNow);
  useEventListener(document, "visibilitychange", () => {
    if (document.visibilityState === "visible") reconnectNow();
  });
});
