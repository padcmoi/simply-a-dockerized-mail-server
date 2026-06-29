import { Body, Controller, Headers, Ip, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { JwtAuthApi, JwtLoginDocs, JwtLogoutDocs, JwtRefreshDocs } from "./jwt.openapi";
import { JwtAuthService } from "./jwt.service";
import { LoginDto, RefreshDto, loginSchema, refreshSchema } from "./jwt.validation";

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
}
