import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const JwtAuthApi = () => applyDecorators(ApiTags("auth-jwt"));

export const JwtLoginDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Exchange username + password for an access + refresh token pair" }),
    ApiResponse({ status: 200, description: "Token pair issued" }),
    ApiResponse({ status: 401, description: "Invalid credentials" })
  );

export const JwtRefreshDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Rotate a refresh token into a fresh access + refresh pair" }),
    ApiResponse({ status: 401, description: "Refresh token invalid or expired" })
  );

export const JwtLogoutDocs = () =>
  applyDecorators(ApiBearerAuth(), UseGuards(AuthGuard("jwt")), ApiOperation({ summary: "Revoke a refresh token (idempotent)" }));

export const JwtMeDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: "Return the profile of the authenticated account" }),
    ApiResponse({ status: 200, description: "Profile returned" }),
    ApiResponse({ status: 401, description: "Missing or invalid access token" })
  );

export const JwtUpdateProfileDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: "Update the authenticated account's display name, email or avatar URL" }),
    ApiResponse({ status: 200, description: "Profile updated" }),
    ApiResponse({ status: 401, description: "Missing or invalid access token" }),
    ApiResponse({ status: 409, description: "Email already in use by another account" })
  );
