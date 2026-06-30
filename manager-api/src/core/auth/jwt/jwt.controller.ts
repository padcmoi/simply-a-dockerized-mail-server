import { Body, Controller, Get, Headers, Ip, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { JwtAuthApi, JwtLoginDocs, JwtLogoutDocs, JwtMeDocs, JwtRefreshDocs, JwtUpdateProfileDocs } from "./jwt.openapi";
import { JwtAuthService } from "./jwt.service";
import { LoginDto, RefreshDto, UpdateProfileDto, loginSchema, refreshSchema, updateProfileSchema } from "./jwt.validation";

type AuthedRequest = Request & { user: { id: number; username: string; isRoot: boolean } };

@JwtAuthApi()
@Controller({ path: "auth/jwt", version: "1" })
export class JwtAuthController {
  constructor(private readonly auth: JwtAuthService) {}

  @Post("login")
  @JwtLoginDocs()
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.login(body.username, body.password, ua, ip);
  }

  @Post("refresh")
  @JwtRefreshDocs()
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.refresh(body.refreshToken, ua, ip);
  }

  @Post("logout")
  @JwtLogoutDocs()
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto) {
    await this.auth.revoke(body.refreshToken);
    return { ok: true };
  }

  @Get("me")
  @JwtMeDocs()
  @UseGuards(AuthGuard("jwt"))
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.id);
  }

  @Patch("me")
  @JwtUpdateProfileDocs()
  @UseGuards(AuthGuard("jwt"))
  updateProfile(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileDto) {
    return this.auth.updateProfile(req.user.id, body);
  }
}
