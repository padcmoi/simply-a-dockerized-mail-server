import { WebSocket } from "ws";

interface Bridge {
  upstream: WebSocket;
  queue: string[];
}

const bridges = new Map<string, Bridge>();

export default defineWebSocketHandler({
  open(peer) {
    const upstream = new WebSocket(useRuntimeConfig().realtimeTarget);
    const bridge: Bridge = { upstream, queue: [] };
    bridges.set(peer.id, bridge);

    upstream.on("open", () => {
      for (const message of bridge.queue.splice(0)) upstream.send(message);
    });
    upstream.on("message", (data) => peer.send(data.toString()));
    upstream.on("close", (code, reason) => {
      peer.close(code, reason.toString());
      bridges.delete(peer.id);
    });
    upstream.on("error", () => {
      peer.close(1011, "upstream error");
      bridges.delete(peer.id);
    });
  },
  message(peer, message) {
    const bridge = bridges.get(peer.id);
    if (!bridge) return;
    const text = message.text();
    if (bridge.upstream.readyState === bridge.upstream.OPEN) bridge.upstream.send(text);
    else bridge.queue.push(text);
  },
  close(peer) {
    bridges.get(peer.id)?.upstream.close();
    bridges.delete(peer.id);
  },
});
