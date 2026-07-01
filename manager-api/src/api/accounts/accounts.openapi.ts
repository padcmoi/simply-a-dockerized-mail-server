import { applyDecorators } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

export const AccountsApi = () => applyDecorators(ApiTags("accounts"), ApiBearerAuth());

export const ListAccountsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List all manager accounts with their domain ACL (root only)",
    })
  );

export const RevokeAccountDocs = () => applyDecorators(ApiOperation({ summary: "Disable a manager account (root only)" }));

export const GetAclDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get domain ACL entries for an account (root only)",
    })
  );

export const SetAclDocs = () => applyDecorators(ApiOperation({ summary: "Replace domain ACL for an account (root only)" }));

export const SendInvitationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Send an invitation email with optional domain scope (root only)",
    })
  );

export const GetInvitationDocs = () => applyDecorators(ApiOperation({ summary: "Fetch invitation details by token (public)" }));

export const AcceptInvitationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Accept an invitation and create an account (public)",
    })
  );
