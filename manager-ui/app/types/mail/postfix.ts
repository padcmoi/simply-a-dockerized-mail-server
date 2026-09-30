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

export type QueueName = keyof QueueDirStats;

export interface QueueMessageRecipient {
  address: string;
  status: string | null;
  reason: string | null;
}

export interface QueueMessage {
  id: string;
  arrivalTime: string;
  size: number;
  sender: string;
  recipients: QueueMessageRecipient[];
}

export interface PostfixQueueMessages {
  queue: QueueName;
  total: number;
  limit: number;
  messages: QueueMessage[];
  available: boolean;
}
