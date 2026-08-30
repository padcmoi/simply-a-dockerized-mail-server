// What a rendered conversation is made of: day separators and message bubbles,
// the entries useMessageThread produces for whatever message type it is given.

// The least a message must carry to be grouped into a thread.
export interface ThreadMessage {
  id: number;
  createdAt: string;
  authorEmail: string | null;
}

export interface ThreadBubble<T> {
  key: string;
  message: T;
  mine: boolean;
  at: string;
  // First of a run from the same author: only that one carries the avatar and
  // the name, the followers stay bare so a burst reads as one block.
  leading: boolean;
  trailing: boolean;
}

export type ThreadEntry<T> = { kind: "day"; key: string; label: string } | ({ kind: "bubble" } & ThreadBubble<T>);
