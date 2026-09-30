import { PostfixService, QUEUE_NAMES, type QueueName } from "../../postfix/postfix.service";
import { Watcher } from "../watcher.type";

export function postfixQueueWatcher(postfix: PostfixService): Watcher {
  return {
    topic: "postfix-queue",
    permissions: [{ resource: "postfix", actions: ["access", "view-postfix-queue"] }],
    fn: () => postfix.queueStats(),
  };
}

export function postfixQueueMessagesWatcher(postfix: PostfixService): Watcher {
  return {
    topic: "postfix-queue-messages",
    parameterized: true,
    permissions: [{ resource: "postfix", actions: ["access", "view-postfix-queue"] }],
    intervalMs: 2_000,
    fn: (param) => ((QUEUE_NAMES as readonly string[]).includes(param ?? "") ? postfix.queueMessages(param as QueueName) : null),
  };
}
