import { Body, Controller, Headers, Ip, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod.pipe";
import { AuthService } from "./auth.service";

const loginSchema = z.object({ username: z.string().min(1).max(255), password: z.string().min(1).max(255) });
const refreshSchema = z.object({ refreshToken: z.string().min(8) });

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.login(body.username, body.password, ua, ip);
  }

  @Post("refresh")
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.refresh(body.refreshToken, ua, ip);
  }

  @Post("logout")
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"))
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    await this.auth.revoke(body.refreshToken);
    return { ok: true };
  }
}
