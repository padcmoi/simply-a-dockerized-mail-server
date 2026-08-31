import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const DelegationsApi = () => applyDecorators(ApiTags("delegations"), ApiSecurity("apiToken"));

const domainIdParam = () => ApiParam({ name: "domainId", type: Number, example: 1 });
const accountIdParam = () => ApiParam({ name: "accountId", type: String, description: "Delegated account id" });

export const ListDelegationsDocs = () =>
  applyDecorators(
    domainIdParam(),
    ApiOperation({ summary: "List the domain's delegations plus its pending invitations and open tokens" })
  );

export const InviteDelegationDocs = () =>
  applyDecorators(
    domainIdParam(),
    ApiOperation({ summary: "Grant a delegation to an existing account by email, or invite that email with the caps staged" })
  );

export const CreateDelegationTokenDocs = () =>
  applyDecorators(
    domainIdParam(),
    ApiOperation({ summary: "Create an open registration link: whoever opens it creates an account and receives these caps" })
  );

export const EditDelegationInviteDocs = () =>
  applyDecorators(
    domainIdParam(),
    ApiParam({ name: "invitationId", type: Number }),
    ApiOperation({ summary: "Edit a pending delegation invitation or open link: caps and expiry" })
  );

export const SetDelegationCapsDocs = () =>
  applyDecorators(
    domainIdParam(),
    accountIdParam(),
    ApiOperation({ summary: "Change a delegation's caps (raise, lower or restrict)" })
  );

export const RevokeDelegationDocs = () =>
  applyDecorators(
    domainIdParam(),
    accountIdParam(),
    ApiOperation({ summary: "Revoke a delegation (already created resources are kept)" })
  );

export const RevokeDelegationInviteDocs = () =>
  applyDecorators(
    domainIdParam(),
    ApiParam({ name: "invitationId", type: Number }),
    ApiOperation({ summary: "Expire a pending delegation invitation or open token" })
  );
