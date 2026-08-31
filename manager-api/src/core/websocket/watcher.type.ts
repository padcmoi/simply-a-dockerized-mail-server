export const MIN_INTERVAL_MS = 500;

export interface TopicPermission {
  resource: string;
  actions: string[];
}

export type TopicScope = "global" | "domain" | "self";

export interface TopicCaller {
  userId: string;
  isRoot: boolean;
}

export interface Watcher {
  topic: string;
  permissions: TopicPermission[];
  scope?: TopicScope;
  parameterized?: boolean;
  intervalMs?: number;
  // Owns the whole subscribe decision for topics whose visibility is a row-level
  // rule the permission catalog cannot express.
  authorize?: (caller: TopicCaller, param: string) => Promise<boolean>;
  fn: (param?: string) => unknown | Promise<unknown>;
}
