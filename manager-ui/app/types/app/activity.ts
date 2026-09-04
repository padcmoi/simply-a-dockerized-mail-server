// One line of the activity journal, as GET /auth/jwt/me/activity and
// GET /activity answer it: the fact, the object it was about, where from.
export interface ActivityRow {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  subjectId: string | null;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  // ISO 3166-1 alpha-2 of the address, empty when unknown or reserved.
  country: string;
  userAgent: string | null;
  createdAt: string;
}
