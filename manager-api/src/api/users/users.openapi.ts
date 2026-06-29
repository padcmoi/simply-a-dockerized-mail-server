import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

export const UsersApi = () => applyDecorators(ApiTags("users"), ApiBearerAuth(), UseGuards(AuthGuard("jwt")));

export const ListUsersDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List mailbox users (optionally filtered by domain)" }),
    ApiQuery({ name: "domain", required: false, type: String })
  );

export const GetUserDocs = () => applyDecorators(ApiOperation({ summary: "Fetch a mailbox user by id" }));

export const CreateUserDocs = () => applyDecorators(ApiOperation({ summary: "Create a mailbox user under an existing domain" }));

export const UpdateUserDocs = () =>
  applyDecorators(ApiOperation({ summary: "Update password / quota / active flag / end-date of a mailbox user" }));

export const RemoveUserDocs = () =>
  applyDecorators(ApiOperation({ summary: "Permanently delete a mailbox user and its mail data" }));
