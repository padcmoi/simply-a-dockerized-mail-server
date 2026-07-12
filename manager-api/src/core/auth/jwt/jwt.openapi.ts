import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const JwtAuthApi = () => applyDecorators(ApiTags("auth-jwt"));

const validationFailedExample = {
  message: "Validation failed",
  issues: [
    {
      code: "too_small",
      minimum: 1,
      type: "string",
      inclusive: true,
      path: ["username"],
      message: "String must contain at least 1 character(s)",
    },
  ],
};

const tokenPairExample = {
  accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyfQ.4pR2r7X1y8example-signature",
  refreshToken: "3q7z1kX9pQ2mN8vY5wE0-example-raw-refresh-token",
  expiresAt: "2026-08-03T12:00:00.000Z",
};

const profileExample = {
  username: "jdoe",
  name: "Example User",
  email: "jdoe@example.com",
  avatarUrl: "https://example.com/avatar.png",
  isRoot: false,
  groups: [{ id: 3, name: "support" }],
};

export const JwtLoginDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Exchange username + password for an access + refresh token pair",
      description:
        "Public endpoint, no authentication required. On success, issues a short-lived JWT access token " +
        "(MANAGER_JWT_ACCESS_TTL, defaults to 900s) plus a long-lived refresh token (MANAGER_JWT_REFRESH_TTL, " +
        "defaults to 30 days). The refresh token is only ever returned in this response and in /auth/jwt/refresh; " +
        "only its SHA-256 hash is persisted.",
    }),
    ApiBody({
      schema: {
        example: { username: "jdoe", password: "correcthorsebattery" },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Token pair issued",
      schema: { example: tokenPairExample },
    }),
    ApiResponse({
      status: 400,
      description: "Validation failed (missing/empty username or password)",
      schema: { example: validationFailedExample },
    }),
    ApiResponse({
      status: 401,
      description: "Invalid credentials, unknown username, or account disabled",
      schema: {
        example: { message: "Invalid credentials", error: "Unauthorized", statusCode: 401 },
      },
    })
  );

export const JwtRefreshDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Rotate a refresh token into a fresh access + refresh pair",
      description:
        "Public endpoint, no authentication required. The supplied refresh token is revoked as soon as it is " +
        "used (single-use rotation) and a brand-new access + refresh pair is returned. Reusing an already-rotated, " +
        "expired, or unknown refresh token fails with 401.",
    }),
    ApiBody({
      schema: {
        example: { refreshToken: "3q7z1kX9pQ2mN8vY5wE0-example-raw-refresh-token" },
      },
    }),
    ApiResponse({
      status: 200,
      description: "New token pair issued",
      schema: { example: tokenPairExample },
    }),
    ApiResponse({
      status: 400,
      description: "Validation failed (refreshToken shorter than 8 characters)",
      schema: {
        example: {
          message: "Validation failed",
          issues: [
            {
              code: "too_small",
              minimum: 8,
              type: "string",
              inclusive: true,
              path: ["refreshToken"],
              message: "String must contain at least 8 character(s)",
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: "Refresh token is unknown, already revoked/rotated, or expired",
      schema: {
        example: { message: "Refresh token invalid", error: "Unauthorized", statusCode: 401 },
      },
    })
  );

export const JwtLogoutDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Revoke a refresh token (idempotent)",
      description:
        "Public endpoint, no authentication required: only knowledge of the refresh token itself is needed. " +
        "Revoking an already-revoked or unknown refresh token still returns 200; the operation never fails on " +
        'an unmatched token so callers can always safely "log out".',
    }),
    ApiBody({
      schema: {
        example: { refreshToken: "3q7z1kX9pQ2mN8vY5wE0-example-raw-refresh-token" },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Refresh token revoked (or was already revoked/unknown)",
      schema: { example: { ok: true } },
    }),
    ApiResponse({
      status: 400,
      description: "Validation failed (refreshToken shorter than 8 characters)",
      schema: { example: validationFailedExample },
    })
  );

export const JwtMeDocs = () =>
  applyDecorators(
    ApiSecurity("apiToken"),
    ApiOperation({
      summary: "Return the profile of the authenticated account",
      description:
        "Self-scoped: always operates on the caller's own account (req.user.id). There is no permission " +
        "requirement beyond being authenticated: every account, regardless of group or global permissions, " +
        "can read its own profile.",
    }),
    ApiResponse({
      status: 200,
      description: "Profile returned",
      schema: { example: profileExample },
    }),
    ApiResponse({
      status: 401,
      description: "Missing or invalid access token / API key",
      schema: { example: { message: "Unauthorized", statusCode: 401 } },
    }),
    ApiResponse({
      status: 404,
      description: "The authenticated account no longer exists (e.g. deleted after the token was issued)",
      schema: { example: { message: "Account not found", error: "Not Found", statusCode: 404 } },
    })
  );

export const JwtMePermissionsDocs = () =>
  applyDecorators(
    ApiSecurity("apiToken"),
    ApiOperation({
      summary: "Return the effective global and domain-scoped permissions of the authenticated account",
      description:
        "Self-scoped: always computed for the caller's own account (req.user.id), no permission requirement " +
        "beyond being authenticated. Domain ownership implicitly grants full access/read/create/modify/delete " +
        "rights on that domain, independently of any group permission row, and is included in the result.",
    }),
    ApiResponse({
      status: 200,
      description: "Effective permissions returned",
      schema: {
        example: {
          global: [
            { resource: "domains", action: "access" },
            { resource: "domains", action: "list-all-domains" },
          ],
          domain: [{ domainId: 5, resource: "recipients", action: "access" }],
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: "Missing or invalid access token / API key",
      schema: { example: { message: "Unauthorized", statusCode: 401 } },
    })
  );

export const JwtMyGroupPermissionsDocs = () =>
  applyDecorators(
    ApiSecurity("apiToken"),
    ApiOperation({
      summary: "Return the permissions of a group the caller belongs to",
      description:
        "Self-scoped: returns the raw global and domain permission rows of a group the caller is a MEMBER of " +
        "(root may read any group). Membership is the only gate, so it works even for an invisible group -- the " +
        "single place a member may inspect what their own group grants, even one hidden everywhere else. A " +
        "non-member non-root gets 403. Domain ids are returned raw; the caller resolves names client-side.",
    }),
    ApiResponse({
      status: 200,
      description: "Group permissions returned",
      schema: {
        example: {
          globalPermissions: [{ resource: "domains", action: "access" }],
          domainPermissions: [{ domainId: 5, resource: "recipients", action: "access" }],
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: "Missing or invalid access token / API key",
      schema: { example: { message: "Unauthorized", statusCode: 401 } },
    }),
    ApiResponse({
      status: 403,
      description: "The caller is not a member of this group (and is not root)",
      schema: { example: { message: "You are not a member of this group", error: "Forbidden", statusCode: 403 } },
    })
  );

export const JwtUpdateProfileDocs = () =>
  applyDecorators(
    ApiSecurity("apiToken"),
    ApiOperation({
      summary: "Update the authenticated account's display name, email or avatar URL",
      description:
        "Self-scoped: always updates the caller's own account (req.user.id), no permission requirement beyond " +
        "being authenticated. Any field omitted from the body is left unchanged; any field explicitly set to " +
        "null clears it. Changing the email to one already used by another account fails with 409.",
    }),
    ApiBody({
      schema: {
        example: {
          name: "Example User",
          email: "jdoe@example.com",
          avatarUrl: "https://example.com/avatar.png",
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: "Profile updated",
      schema: { example: profileExample },
    }),
    ApiResponse({
      status: 400,
      description: "Validation failed (invalid email, invalid avatar URL, or field too long)",
      schema: {
        example: {
          message: "Validation failed",
          issues: [
            {
              validation: "email",
              code: "invalid_string",
              message: "Invalid email",
              path: ["email"],
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: "Missing or invalid access token / API key",
      schema: { example: { message: "Unauthorized", statusCode: 401 } },
    }),
    ApiResponse({
      status: 404,
      description: "The authenticated account no longer exists",
      schema: { example: { message: "Account not found", error: "Not Found", statusCode: 404 } },
    }),
    ApiResponse({
      status: 409,
      description: "Email already in use by another account",
      schema: {
        example: {
          message: "Email jdoe@example.com is already used by another account",
          error: "Conflict",
          statusCode: 409,
        },
      },
    })
  );
