// The postfix queue counters, server-wide or narrowed to one domain.

export interface QueueDirStats {
  active: number;
  deferred: number;
  hold: number;
  incoming: number;
}

export interface PostfixQueueStats {
  total: QueueDirStats;
  domain?: QueueDirStats;
  available: boolean;
}
