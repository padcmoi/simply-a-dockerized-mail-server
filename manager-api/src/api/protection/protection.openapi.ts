import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const ProtectionApi = () => applyDecorators(ApiTags("protection"), ApiSecurity("apiToken"));

const params = () =>
  applyDecorators(
    ApiParam({ name: "type", enum: ["account", "recipient", "alias", "domain"] }),
    ApiParam({ name: "id", example: "12", description: "The account uuid, or the mailbox, alias or domain id" })
  );

export const ProtectDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Protect an account, a mailbox, an alias or a domain",
      description:
        "Sets its `is_protected` flag. A protected resource can be neither edited, nor deleted, nor given another owner, by " +
        "anyone, root included, until it is unprotected; every route that would do so answers 403 `protection.locked`. " +
        "An account or a domain can only be protected by a root account, whatever the permissions held: the permission covers mailboxes and aliases. Recorded in the activity journal.",
    }),
    params(),
    ApiResponse({ status: 204, description: "Protected (protecting twice changes nothing)" }),
    ApiResponse({ status: 400, description: "Unknown type or malformed id" }),
    ApiResponse({
      status: 403,
      description:
        "Missing misc:access and/or misc:protect-resource, or an account or a domain and the caller is not a root account",
    }),
    ApiResponse({ status: 404, description: "No such resource" })
  );

export const UnprotectDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Unprotect an account, a mailbox, an alias or a domain",
      description:
        "Clears its `is_protected` flag. Root accounts only: no permission grants it. Recorded in the activity journal.",
    }),
    params(),
    ApiResponse({ status: 204, description: "Unprotected" }),
    ApiResponse({ status: 400, description: "Unknown type or malformed id" }),
    ApiResponse({ status: 403, description: "Not a root account" }),
    ApiResponse({ status: 404, description: "No such resource" })
  );
