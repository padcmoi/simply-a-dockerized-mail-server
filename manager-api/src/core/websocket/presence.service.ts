import { Injectable } from "@nestjs/common";

// Who is currently consuming which topic. The gateway feeds it on subscribe and
// unsubscribe; anything that needs to know whether an account is already
// watching something live reads it, without depending on the gateway itself.
// Counted per account, so a second tab does not cancel the first one's presence.
@Injectable()
export class TopicPresenceService {
  private readonly byTopic = new Map<string, Map<string, number>>();

  join(userId: string, topic: string) {
    const counts = this.byTopic.get(topic) ?? new Map<string, number>();
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
    this.byTopic.set(topic, counts);
  }

  leave(userId: string, topic: string) {
    const counts = this.byTopic.get(topic);
    if (!counts) return;
    const left = (counts.get(userId) ?? 0) - 1;
    if (left > 0) counts.set(userId, left);
    else counts.delete(userId);
    if (!counts.size) this.byTopic.delete(topic);
  }

  watchers(topic: string): Set<string> {
    return new Set(this.byTopic.get(topic)?.keys() ?? []);
  }

  isWatching(userId: string, topic: string): boolean {
    return (this.byTopic.get(topic)?.get(userId) ?? 0) > 0;
  }
}
