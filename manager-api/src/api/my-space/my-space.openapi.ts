import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const MySpaceApi = () => applyDecorators(ApiTags("my-space"), ApiSecurity("apiToken"));

const recipientIdParam = () =>
  ApiParam({ name: "id", type: Number, example: 1, description: "Id of a recipient the caller owns" });
const aliasIdParam = () => ApiParam({ name: "id", type: Number, example: 1, description: "Id of an alias the caller owns" });

export const GetMyRecipientDocs = () =>
  applyDecorators(recipientIdParam(), ApiOperation({ summary: "Read one recipient the caller owns" }));

export const UpdateMyRecipientDocs = () =>
  applyDecorators(
    recipientIdParam(),
    ApiOperation({ summary: "Change the password or the active flag of a recipient the caller owns" })
  );

export const GetMyAliasDocs = () => applyDecorators(aliasIdParam(), ApiOperation({ summary: "Read one alias the caller owns" }));

export const UpdateMyAliasDocs = () =>
  applyDecorators(aliasIdParam(), ApiOperation({ summary: "Change the destination of an alias the caller owns" }));

export const DeleteMyRecipientDocs = () =>
  applyDecorators(recipientIdParam(), ApiOperation({ summary: "Delete a recipient the caller owns" }));

export const DeleteMyAliasDocs = () =>
  applyDecorators(aliasIdParam(), ApiOperation({ summary: "Delete an alias the caller owns" }));
