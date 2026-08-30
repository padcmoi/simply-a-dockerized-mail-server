// Notifications: the rows, the live feed, and the per-source preferences.

export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];

export interface NotificationRow {
  id: number;
  source: string;
  type: string;
  payload: {
    ticketId?: number;
    subject?: string;
    domainName?: string | null;
    actor?: string | null;
    status?: string;
    /** Machine alerts: which figure went red, and how far it went. */
    metric?: string;
    percent?: number;
  } | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeed {
  unread: number;
  items: NotificationRow[];
}

export interface NotificationChannels {
  inApp: boolean;
  email: boolean;
}

export type NotificationPreferences = Record<NotificationSource, NotificationChannels>;
