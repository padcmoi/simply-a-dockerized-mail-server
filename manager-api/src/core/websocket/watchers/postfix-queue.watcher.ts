import { PostfixService } from "../../postfix/postfix.service";
import { Watcher } from "../watcher.type";

export function postfixQueueWatcher(postfix: PostfixService): Watcher {
  return {
    topic: "postfix-queue",
    permissions: [{ resource: "postfix", actions: ["access", "view-postfix-queue"] }],
    fn: () => postfix.queueStats(),
  };
}
