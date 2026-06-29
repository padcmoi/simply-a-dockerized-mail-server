import { Body, Controller, Headers, Ip, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AuthService } from "./auth.service";
import { AuthApi, LoginDocs, LogoutDocs, RefreshDocs } from "./auth.openapi";
import { LoginDto, RefreshDto, loginSchema, refreshSchema } from "./auth.validation";

@AuthApi()
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @LoginDocs()
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.login(body.username, body.password, ua, ip);
  }

  @Post("refresh")
  @RefreshDocs()
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.refresh(body.refreshToken, ua, ip);
  }

  @Post("logout")
  @LogoutDocs()
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto) {
    await this.auth.revoke(body.refreshToken);
    return { ok: true };
  }
}
