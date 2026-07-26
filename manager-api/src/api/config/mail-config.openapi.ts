import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const MailConfigApi = () => applyDecorators(ApiTags("config"));

const configExample = {
  provider: "brevo",
  host: null,
  port: null,
  secure: false,
  username: "login@example.com",
  fromAddress: "noreply@yourdomain.com",
  password: "xsmtpsib-secret-value",
  validated: true,
};

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetMailConfigDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List every stored provider config and which one is active" }),
    ApiResponse({ status: 200, schema: { example: { configs: [configExample], selected: "brevo" } } }),
    RootOnly()
  );

export const SaveMailConfigDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Create or update one provider config; resets its validation" }),
    ApiBody({
      schema: {
        example: {
          provider: "brevo",
          username: "login@example.com",
          password: "xsmtpsib-secret",
          fromAddress: "noreply@yourdomain.com",
        },
      },
    }),
    ApiResponse({ status: 200, schema: { example: configExample } }),
    ApiResponse({ status: 400, description: "Body failed the per-provider validation" }),
    RootOnly()
  );

export const TestMailConfigDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Email a 6-digit activation code through a provider config" }),
    ApiBody({ schema: { example: { provider: "brevo" } } }),
    ApiResponse({ status: 201, schema: { example: { ok: true } } }),
    ApiResponse({ status: 502, schema: { example: { statusCode: 502, code: "mail.sendFailed" } } }),
    ApiResponse({ status: 503, schema: { example: { statusCode: 503, code: "mail.notConfigured" } } }),
    RootOnly()
  );

export const VerifyMailConfigDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Validate and activate a provider by confirming its emailed code" }),
    ApiBody({ schema: { example: { provider: "brevo", otp: "123456" } } }),
    ApiResponse({ status: 201, schema: { example: { configs: [configExample], selected: "brevo" } } }),
    ApiResponse({ status: 400, schema: { example: { statusCode: 400, code: "mail.otpInvalid" } } }),
    RootOnly()
  );

export const SelectMailConfigDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Make an already-validated provider the active one, no new code" }),
    ApiBody({ schema: { example: { provider: "brevo" } } }),
    ApiResponse({ status: 201, schema: { example: { configs: [configExample], selected: "brevo" } } }),
    RootOnly()
  );

export const DisableMailConfigDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Turn outbound mail off; every provider keeps its validation" }),
    ApiResponse({ status: 201, schema: { example: { configs: [configExample], selected: null } } }),
    RootOnly()
  );
