import { Body, Controller, Get, Headers, HttpCode, Ip, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { CustomPermissionGuardService } from "../../custom-permission-guard/custom-permission-guard.service";
import { Public } from "../auth.decorator";
import {
  JwtAuthApi,
  JwtLoginDocs,
  JwtLogoutDocs,
  JwtMeDocs,
  JwtMePermissionsDocs,
  JwtRefreshDocs,
  JwtUpdateProfileDocs,
} from "./jwt.openapi";
import { JwtAuthService } from "./jwt.service";
import { LoginDto, RefreshDto, UpdateProfileDto, loginSchema, refreshSchema, updateProfileSchema } from "./jwt.validation";

type AuthedRequest = Request & {
  user: { id: string; username: string; isRoot: boolean };
};

@JwtAuthApi()
@Controller({ path: "auth/jwt", version: "1" })
export class JwtAuthController {
  constructor(
    private readonly auth: JwtAuthService,
    private readonly cpg: CustomPermissionGuardService
  ) {}

  @Post("login")
  @Public()
  @HttpCode(200)
  @JwtLoginDocs()
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.login(body.username, body.password, ua, ip);
  }

  @Post("refresh")
  @Public()
  @HttpCode(200)
  @JwtRefreshDocs()
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.refresh(body.refreshToken, ua, ip);
  }

  @Post("logout")
  @Public()
  @HttpCode(200)
  @JwtLogoutDocs()
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto) {
    await this.auth.revoke(body.refreshToken);
    return { ok: true };
  }

  @Get("me")
  @JwtMeDocs()
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.id);
  }

  @Patch("me")
  @JwtUpdateProfileDocs()
  updateProfile(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileDto) {
    return this.auth.updateProfile(req.user.id, body);
  }

  @Get("me/permissions")
  @JwtMePermissionsDocs()
  mePermissions(@Req() req: AuthedRequest) {
    return this.cpg.guard.getEffectivePermissions(req.user.id);
  }
}
