import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

export const PassportAuthApi = () => applyDecorators(ApiTags("auth"));

const providerParam = () =>
  ApiParam({ name: "provider", type: String, description: "Provider id from GET /auth/passport/providers, e.g. google" });

export const PassportProvidersDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List the external sign-in providers this server offers",
      description:
        "Public: it is what the login screen draws its buttons from. A provider appears only when the manager URL " +
        "is set, the master switch is on, the provider itself is on, and its credentials are set in the " +
        "environment. Whether this server hands out accounts to unknown addresses is deliberately not part of " +
        "this answer.",
    }),
    ApiResponse({ status: 200, schema: { example: [{ id: "google", label: "Google" }] } })
  );

export const PassportStartDocs = () =>
  applyDecorators(
    providerParam(),
    ApiOperation({
      summary: "Begin a sign-in with one provider",
      description:
        "Answers a redirect to the provider's own consent screen, built by that provider's Passport strategy. The " +
        "callback URL is derived from the manager URL (Configuration -> General), so it matches what is registered " +
        "with the provider. Not a JSON endpoint: a browser is meant to follow it.",
    }),
    ApiResponse({ status: 302, description: "Redirect to the provider" }),
    ApiResponse({ status: 503, description: "Provider unknown, switched off, missing credentials, or no manager URL" })
  );

export const PassportCallbackDocs = () =>
  applyDecorators(
    providerParam(),
    ApiOperation({
      summary: "Where the provider sends the browser back",
      description:
        "Never answers a body: the browser leaves with a redirect to the login screen, carrying either a one-time " +
        "code to trade for a session (`?provider_code=`) or a flat refusal (`?provider_error=refused`). The token pair is " +
        "deliberately not put in this URL, since a redirect URL reaches the history, the referrer and every log on " +
        "the way.",
    }),
    ApiResponse({ status: 302, description: "Redirect to /login with a one-time code or a refusal" }),
    ApiResponse({ status: 503, description: "Provider unknown, switched off, missing credentials, or no manager URL" })
  );

export const PassportExchangeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Trade the one-time code for the usual token pair",
      description:
        "Single use and valid for thirty seconds. What comes back is exactly what POST /auth/jwt/login answers, so " +
        "everything downstream of a session is unaware there was ever a second way in.",
    }),
    ApiBody({ schema: { example: { code: "3q7z1kX9pQ2mN8vY5wE0-example-one-time-code" } } }),
    ApiResponse({
      status: 200,
      description: "Session opened",
      schema: {
        example: {
          accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyfQ.4pR2r7X1y8example-signature",
          refreshToken: "3q7z1kX9pQ2mN8vY5wE0-example-raw-refresh-token",
          expiresAt: "2026-09-01T12:00:00.000Z",
        },
      },
    }),
    ApiResponse({ status: 401, description: "Code unknown, already spent, expired, or the account is disabled" })
  );
