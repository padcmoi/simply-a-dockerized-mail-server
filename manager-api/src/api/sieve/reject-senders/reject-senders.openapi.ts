import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

export const RejectSendersApi = () => applyDecorators(ApiTags("sieve"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const ListRejectSendersDocs = () =>
  applyDecorators(ApiOperation({ summary: "List entries on the postfix SMTP-time sender blacklist" }));

export const CreateRejectSenderDocs = () =>
  applyDecorators(ApiOperation({ summary: "Add a sender (email or `@domain`) to the SMTP-time blacklist" }));

export const ToggleRejectSenderDocs = () =>
  applyDecorators(ApiOperation({ summary: "Enable / disable a blacklist entry without deleting it" }));

export const RemoveRejectSenderDocs = () => applyDecorators(ApiOperation({ summary: "Delete a blacklist entry" }));
