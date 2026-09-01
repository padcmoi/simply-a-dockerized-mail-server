import { Body, Controller, Get, Headers, HttpCode, Ip, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { Public } from "../auth.decorator";
import {
  PassportAuthApi,
  PassportCallbackDocs,
  PassportExchangeDocs,
  PassportProvidersDocs,
  PassportStartDocs,
} from "./passport.openapi";
import { PassportProviderGuard } from "./passport.guard";
import type { ProviderIdentity } from "./passport-providers";
import { PassportAuthService } from "./passport.service";
import { PassportExchangeDto, passportExchangeSchema } from "./passport.validation";

type ProviderRequest = Request & { user?: ProviderIdentity };

@PassportAuthApi()
@Controller({ path: "auth/passport", version: "1" })
export class PassportAuthController {
  constructor(private readonly passport: PassportAuthService) {}

  // Declared before the `:provider` routes so it is matched as the literal it
  // is, not as a provider named "providers".
  @Get("providers")
  @Public()
  @PassportProvidersDocs()
  providers() {
    return this.passport.publicProviders();
  }

  @Post("exchange")
  @Public()
  @HttpCode(200)
  @PassportExchangeDocs()
  exchange(
    @Body(new ZodValidationPipe(passportExchangeSchema)) body: PassportExchangeDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.passport.redeem(body.code, ua, ip);
  }

  // Passport answers this one entirely: the guard hands the browser its
  // redirect to the provider, so control never reaches the handler.
  @Get(":provider")
  @Public()
  @UseGuards(PassportProviderGuard)
  @PassportStartDocs()
  start() {
    return undefined;
  }

  // Where the provider sends the browser back. Nothing is returned as a body:
  // a browser is standing here, so it leaves with a redirect either way, and
  // the failure carries a reason the login screen can name rather than a stack.
  @Get(":provider/callback")
  @Public()
  @UseGuards(PassportProviderGuard)
  @PassportCallbackDocs()
  async callback(@Req() req: ProviderRequest, @Res() res: Response, @Param("provider") provider: string) {
    if (!req.user) return res.redirect(this.passport.loginRedirect({ provider_error: "refused", provider }));
    try {
      const code = await this.passport.codeForIdentity(req.user);
      return res.redirect(this.passport.loginRedirect({ provider_code: code }));
    } catch {
      // Deliberately flat: an address no account answers to, a disabled account
      // and an unverified email are the same answer to whoever is standing at
      // the door, and telling them which one they got only helps them get it
      // right.
      return res.redirect(this.passport.loginRedirect({ provider_error: "refused", provider }));
    }
  }
}
