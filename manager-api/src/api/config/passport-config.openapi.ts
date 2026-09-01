import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

export const PassportConfigApi = () => applyDecorators(ApiTags("config"));

const readExample = {
  passportEnabled: true,
  passportAutoProvision: false,
  managerUrlSet: true,
  providers: [
    {
      id: "google",
      label: "Google",
      configured: true,
      enabled: true,
      clientId: "355148084917-example.apps.googleusercontent.com",
      javascriptOrigin: "https://mail-manager.example.com",
      redirectUri: "https://mail-manager.example.com/api/v1/auth/passport/google/callback",
    },
  ],
};

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

const providerParam = () => ApiParam({ name: "provider", type: String, description: "Provider id, e.g. google" });

export const GetPassportConfigDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read the external sign-in settings and every known provider",
      description:
        "Each provider carries the two URLs its own console has to be given: `javascriptOrigin` and `redirectUri`, " +
        "both derived from the manager URL (Configuration -> General). They are answered rather than documented " +
        "because getting them wrong is the most common way a sign-in fails. The client secret is never part of " +
        "this answer: `configured` says whether one is stored, nothing more. `managerUrlSet` false means no " +
        "provider can work at all, whatever the switches say, since the callback cannot be built.",
    }),
    ApiResponse({ status: 200, schema: { example: readExample } }),
    RootOnly()
  );

export const UpdatePassportConfigDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Turn external sign-in and account creation on or off",
      description:
        "Turning `passportAutoProvision` on means anyone holding an address at a switched-on provider can obtain " +
        "an account: it carries no password, no root flag and nothing beyond the default group, so it arrives with " +
        "the floor of the permission model. An API key minted by such an account is capped by that same account.",
    }),
    ApiBody({ schema: { example: { passportEnabled: true, passportAutoProvision: false } } }),
    ApiResponse({ status: 200, schema: { example: readExample } }),
    RootOnly()
  );

export const UpsertProviderCredentialsDocs = () =>
  applyDecorators(
    providerParam(),
    ApiOperation({
      summary: "Store or replace one provider's credentials",
      description:
        "The secret is sealed with AES-256-GCM before it is written and is never answered back, so the interface " +
        "shows a provider as configured rather than showing what it holds. It may be omitted on a later call: " +
        "changing only the client id or only the on/off flag keeps the stored secret. It is required the first " +
        "time. The strategy is rebuilt and registered with Passport immediately, so the next sign-in uses the new " +
        "credentials with no restart.",
    }),
    ApiBody({
      schema: {
        example: {
          clientId: "355148084917-example.apps.googleusercontent.com",
          clientSecret: "GOCSPX-example-secret",
          enabled: true,
        },
      },
    }),
    ApiResponse({ status: 200, schema: { example: readExample } }),
    ApiResponse({ status: 400, description: "Invalid body, or no secret on a first configuration" }),
    ApiResponse({ status: 404, description: "Unknown provider id" }),
    RootOnly()
  );

export const DeleteProviderCredentialsDocs = () =>
  applyDecorators(
    providerParam(),
    ApiOperation({
      summary: "Forget one provider's credentials",
      description:
        "The row goes, the strategy is unregistered from Passport at once, and the provider reads as never " +
        "configured again. Accounts already linked to it keep their link: only the way in is removed, not the " +
        "identities behind it.",
    }),
    ApiResponse({ status: 200, schema: { example: readExample } }),
    ApiResponse({ status: 404, description: "Unknown provider id" }),
    RootOnly()
  );
