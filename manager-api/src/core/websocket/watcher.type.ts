export const MIN_INTERVAL_MS = 500;

export interface TopicPermission {
  resource: string;
  actions: string[];
}

export type TopicScope = "global" | "domain";

export interface Watcher {
  topic: string;
  permissions: TopicPermission[];
  scope?: TopicScope;
  parameterized?: boolean;
  intervalMs?: number;
  fn: (param?: string) => unknown | Promise<unknown>;
}
