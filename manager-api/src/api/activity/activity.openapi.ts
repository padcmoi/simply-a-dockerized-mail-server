import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_SEARCHABLE_COLUMNS,
  ACTIVITY_SORTABLE_COLUMNS,
} from "../../core/activity/activity-log.service";
import { ApiPaginationQuery, paginatedExample } from "../../core/common/pagination.openapi";

export const ActivityApi = () => applyDecorators(ApiTags("activity"), ApiSecurity("apiToken"));

const lineExample = {
  id: "412",
  action: "recipients.created",
  actorId: "3d9d6415-537d-421a-a0be-8920bbdf4ce5",
  actorEmail: "jdoe@example.com",
  subjectId: "3d9d6415-537d-421a-a0be-8920bbdf4ce5",
  entityType: "recipient",
  entityId: "17",
  entityLabel: "alice@example.com",
  details: null,
  ip: "203.0.113.7",
  country: "FR",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/128.0",
  createdAt: "2026-09-04T10:00:00.000Z",
};

const filters = () =>
  applyDecorators(
    ApiPaginationQuery(ACTIVITY_SORTABLE_COLUMNS, ACTIVITY_SEARCHABLE_COLUMNS),
    ApiQuery({ name: "action", required: false, enum: ACTIVITY_ACTIONS, description: "Keep one kind of event" })
  );

export const MyActivityDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The caller's own activity: what it did, and what was done to its account",
      description:
        "Session-scoped. One line per event, newest first: sign-ins (accepted and refused), the second factor, " +
        "password and email changes, mailboxes, aliases, tickets, API keys, grants. The fact and the object, never " +
        "the content. Lines written by an administrator on this account are included.",
    }),
    filters(),
    ApiResponse({ status: 200, schema: { example: paginatedExample(lineExample) } })
  );

export const AllActivityDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Every account's activity",
      description:
        "Requires supervision:view-activity-log. The same lines as GET /auth/jwt/me/activity, for every account, " +
        "with the actor's address; `actorId` narrows to one account.",
    }),
    filters(),
    ApiQuery({ name: "actorId", required: false, type: String, description: "Keep one account's lines" }),
    ApiResponse({ status: 200, schema: { example: paginatedExample(lineExample) } })
  );

export const ActivityActionsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Every kind of event a line may carry",
      description: "The catalog the filter offers, owned here so the interface never carries a copy of it.",
    }),
    ApiResponse({ status: 200, schema: { example: ACTIVITY_ACTIONS.slice(0, 4) } })
  );
