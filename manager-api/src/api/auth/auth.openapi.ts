import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const AuthApi = () => applyDecorators(ApiTags("auth"));

export const LoginDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Exchange username + password for an access + refresh token pair" }),
    ApiResponse({ status: 200, description: "Token pair issued" }),
    ApiResponse({ status: 401, description: "Invalid credentials" })
  );

export const RefreshDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Rotate a refresh token into a fresh access + refresh pair" }),
    ApiResponse({ status: 401, description: "Refresh token invalid or expired" })
  );

export const LogoutDocs = () =>
  applyDecorators(ApiBearerAuth(), UseGuards(AuthGuard("jwt")), ApiOperation({ summary: "Revoke a refresh token (idempotent)" }));
