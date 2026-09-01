import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";

export const SendInvitationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Send an invitation email with an optional target group (root only)",
      description:
        "If `groupId` is omitted or null, the invitation falls back to whichever group is currently flagged as default, if any. Any previous unaccepted, still-valid invitation for the same email is expired immediately.",
    }),
    ApiBody({
      schema: {
        example: {
          email: "jdoe@example.com",
          domainId: 1,
          groupIds: ["3f2a1b4c-0000-0000-0000-000000000000"],
          makeOwner: false,
        },
      },
    }),
    ApiResponse({ status: 201, description: "Invitation email sent", schema: { example: { ok: true } } }),
    ApiResponse({ status: 400, description: "Invalid body (e.g. malformed email)" }),
    ApiResponse({ status: 401, description: "Missing or invalid credentials" }),
    ApiResponse({ status: 403, description: "Root access required" }),
    ApiResponse({ status: 404, description: "The given group id does not exist" })
  );

export const GetInvitationDocs = () =>
  applyDecorators(
    ApiParam({ name: "token", type: String, description: "Invitation token from the invite link" }),
    ApiOperation({ summary: "Fetch invitation details by token (public)" }),
    ApiResponse({
      status: 200,
      description: "Invitation details returned",
      schema: { example: { email: "jdoe@example.com", groups: ["Support Team"], expiresAt: "2026-07-11T10:00:00.000Z" } },
    }),
    ApiResponse({ status: 400, description: "Invitation already used, or expired" }),
    ApiResponse({ status: 404, description: "Invitation not found" })
  );

export const EmailExistsDocs = () =>
  applyDecorators(
    ApiParam({ name: "token", type: String }),
    ApiOperation({ summary: "Whether the given email already has an account, gated by a valid pending open link" })
  );

export const ClaimInvitationDocs = () =>
  applyDecorators(
    ApiParam({ name: "token", type: String }),
    ApiOperation({
      summary: "Consume an open registration link with the caller's existing account, taking its staged delegation",
    })
  );

export const AcceptInvitationDocs = () =>
  applyDecorators(
    ApiParam({ name: "token", type: String, description: "Invitation token from the invite link" }),
    ApiOperation({ summary: "Accept an invitation and create an account (public)" }),
    ApiBody({
      schema: {
        example: { password: "correct-horse-battery-staple", firstName: "John", lastName: "Doe" },
      },
    }),
    ApiResponse({ status: 201, description: "Account created", schema: { example: { ok: true, email: "jdoe@example.com" } } }),
    ApiResponse({ status: 400, description: "Invalid body, or invitation already used, or invitation expired" }),
    ApiResponse({ status: 404, description: "Invitation not found" }),
    ApiResponse({ status: 409, description: "An account with this email already exists" })
  );
