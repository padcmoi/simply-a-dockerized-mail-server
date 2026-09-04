import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const TwoFactorApi = () => applyDecorators(ApiTags("auth-two-factor"));

const statusExample = { enabled: true, enabledAt: "2026-09-04T10:00:00.000Z", recoveryCodesLeft: 7 };

const recoveryCodesExample = {
  recoveryCodes: [
    "K7PQ2-XM4NB",
    "A3HWD-9RT5Y",
    "ZC6EF-GH8JK",
    "L2MN4-P5QR7",
    "S8TU9-VW3XY",
    "B4CD6-EF7GH",
    "J9KL2-MN3PQ",
    "R5ST7-UV8WX",
  ],
};

const invalidCodeExample = { statusCode: 400, code: "twoFactor.invalidCode", params: {}, message: "This code is not valid" };

const codeBody = ApiBody({ schema: { example: { code: "123456" } } });

export const TwoFactorStatusDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Whether the caller's second factor is on, and how many recovery codes remain",
      description:
        "Session-scoped. `enabled` is false both when nothing was ever set up and while a setup is pending, " +
        "since a pending secret plays no part in signing in.",
    }),
    ApiResponse({ status: 200, schema: { example: statusExample } })
  );

export const TwoFactorSetupDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Start enrolling an authenticator app: a fresh secret and the otpauth URI to scan",
      description:
        "Session-scoped, JWT only. Generates a secret and stores it as pending: nothing changes at sign-in until " +
        "POST /enable proves a code from it. Calling again replaces the pending secret. Refused with 409 while " +
        "the factor is enabled; disable it first.",
    }),
    ApiResponse({
      status: 200,
      schema: {
        example: {
          secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
          otpauthUri:
            "otpauth://totp/Simply%20Mail%20Server%3Ajdoe%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Simply+Mail+Server&algorithm=SHA1&digits=6&period=30",
        },
      },
    }),
    ApiResponse({ status: 409, description: "Already enabled" })
  );

export const TwoFactorEnableDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Turn the second factor on with a code from the app, and receive the recovery codes",
      description:
        "Session-scoped, JWT only. The code must come from the pending secret. The eight recovery codes are " +
        "returned here and nowhere else: only their hashes are kept. From this answer on, every sign-in needs a code.",
    }),
    codeBody,
    ApiResponse({ status: 200, schema: { example: recoveryCodesExample } }),
    ApiResponse({ status: 400, description: "Wrong code, or no setup pending", schema: { example: invalidCodeExample } }),
    ApiResponse({ status: 409, description: "Already enabled" }),
    ApiResponse({ status: 429, description: "Five wrong codes in a row: locked for fifteen minutes" })
  );

export const TwoFactorDisableDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Turn the second factor off",
      description:
        "Session-scoped, JWT only. Takes a code from the app or an unused recovery code, so a lost phone is not a " +
        "locked account. The secret and the remaining recovery codes are deleted.",
    }),
    codeBody,
    ApiResponse({ status: 200, schema: { example: { disabled: true } } }),
    ApiResponse({ status: 400, description: "Wrong code, or not enabled", schema: { example: invalidCodeExample } }),
    ApiResponse({ status: 429, description: "Five wrong codes in a row: locked for fifteen minutes" })
  );

export const TwoFactorRecoveryCodesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Replace the recovery codes with a new set",
      description:
        "Session-scoped, JWT only. Takes a code from the app, never a recovery code. The previous set stops working, " +
        "used or not.",
    }),
    codeBody,
    ApiResponse({ status: 200, schema: { example: recoveryCodesExample } }),
    ApiResponse({ status: 400, description: "Wrong code, or not enabled", schema: { example: invalidCodeExample } }),
    ApiResponse({ status: 429, description: "Five wrong codes in a row: locked for fifteen minutes" })
  );

export const TwoFactorLoginDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Second step of a sign-in: trade the challenge and a code for the token pair",
      description:
        "Public. When an account with the second factor on signs in (password or external provider), the sign-in " +
        "route answers `{ twoFactorRequired: true, challenge, expiresAt }` instead of tokens. The challenge is opaque, " +
        "lives five minutes, answers at most five attempts and is spent by an accepted code. Takes a code from the " +
        "app or a recovery code. The answer is the same token pair POST /auth/jwt/login gives.",
    }),
    ApiBody({ schema: { example: { challenge: "9kQ2...one-time-challenge", code: "123456" } } }),
    ApiResponse({
      status: 200,
      schema: {
        example: {
          accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyfQ.4pR2r7X1y8example-signature",
          refreshToken: "3q7z1kX9pQ2mN8vY5wE0-example-raw-refresh-token",
          expiresAt: "2026-08-03T12:00:00.000Z",
        },
      },
    }),
    ApiResponse({ status: 400, description: "Wrong code", schema: { example: invalidCodeExample } }),
    ApiResponse({
      status: 401,
      description: "Challenge unknown, expired, or out of attempts: start the sign-in again",
      schema: {
        example: { statusCode: 401, code: "twoFactor.challengeExpired", params: {}, message: "Start the sign-in again" },
      },
    })
  );

export const AdminResetTwoFactorDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Remove an account's second factor without a code",
      description:
        "Requires accounts:edit-account. For an account whose phone and recovery codes are both gone: the factor is " +
        "deleted and the account signs in with its password alone until it enrols again.",
    }),
    ApiResponse({ status: 200, schema: { example: { reset: true } } })
  );
