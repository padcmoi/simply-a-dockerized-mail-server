import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

export const RecipientsApi = () =>
  applyDecorators(
    ApiTags("domain-recipients"),
    ApiBearerAuth(),
    UseGuards(AuthGuard("jwt")),
    ApiParam({
      name: "domainId",
      type: Number,
      description: "Parent virtual_domains.id",
    })
  );

export const ListRecipientsDocs = () => applyDecorators(ApiOperation({ summary: "List recipients that belong to this domain" }));

export const GetRecipientDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Fetch a recipient by id (must belong to this domain)",
    })
  );

export const CreateRecipientDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Create a recipient under this domain; body carries only the local-part",
    })
  );

export const UpdateRecipientDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Update password / quota / active flag / end-date of a recipient in this domain",
    })
  );

export const RemoveRecipientDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Permanently delete a recipient from this domain",
    })
  );
