export const MIN_INTERVAL_MS = 500;

export interface TopicPermission {
  resource: string;
  actions: string[];
}

export interface Watcher {
  topic: string;
  permissions: TopicPermission[];
  intervalMs?: number;
  fn: () => unknown | Promise<unknown>;
}
