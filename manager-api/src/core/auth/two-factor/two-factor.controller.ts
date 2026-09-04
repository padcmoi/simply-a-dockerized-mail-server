import { Body, Controller, Delete, Get, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { Auth } from "../auth.decorator";
import {
  TwoFactorApi,
  TwoFactorDisableDocs,
  TwoFactorEnableDocs,
  TwoFactorRecoveryCodesDocs,
  TwoFactorSetupDocs,
  TwoFactorStatusDocs,
} from "./two-factor.openapi";
import { TwoFactorService } from "./two-factor.service";
import { TwoFactorCodeDto, twoFactorCodeSchema } from "./two-factor.validation";

type AuthedRequest = Request & { user: { id: string; email: string; isRoot: boolean } };

// The caller's own second factor. JWT only, never an API key: a key acts for
// the account within its scopes, and switching off what protects the account's
// sign-in is not within any scope a key can be given.
@TwoFactorApi()
@Auth("JWT")
@Controller({ path: "auth/jwt/me/two-factor", version: "1" })
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @Get()
  @TwoFactorStatusDocs()
  status(@Req() req: AuthedRequest) {
    return this.twoFactor.status(req.user.id);
  }

  @Post("setup")
  @HttpCode(200)
  @TwoFactorSetupDocs()
  setup(@Req() req: AuthedRequest) {
    return this.twoFactor.beginSetup(req.user.id, req.user.email);
  }

  @Post("enable")
  @HttpCode(200)
  @TwoFactorEnableDocs()
  enable(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(twoFactorCodeSchema)) body: TwoFactorCodeDto) {
    return this.twoFactor.enable(req.user.id, body.code);
  }

  @Delete()
  @TwoFactorDisableDocs()
  disable(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(twoFactorCodeSchema)) body: TwoFactorCodeDto) {
    return this.twoFactor.disable(req.user.id, body.code);
  }

  @Post("recovery-codes")
  @HttpCode(200)
  @TwoFactorRecoveryCodesDocs()
  recoveryCodes(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(twoFactorCodeSchema)) body: TwoFactorCodeDto) {
    return this.twoFactor.regenerateRecoveryCodes(req.user.id, body.code);
  }
}
