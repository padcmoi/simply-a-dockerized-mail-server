import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { Auth } from "../auth.decorator";
import { MfaApi, SecurityQuestionStatusDocs, SetSecurityQuestionDocs } from "./mfa.openapi";
import { MfaService } from "./mfa.service";
import { SetSecurityQuestionDto, setSecurityQuestionSchema } from "./mfa.validation";

type AuthedRequest = Request & { user: { id: string; email: string; isRoot: boolean } };

// The caller's own security question. JWT only, never an API key: a key acts
// for the account within its scopes, and rewriting the way back into the
// account is not within any scope a key can be given.
@MfaApi()
@Auth("JWT")
@Controller({ path: "auth/jwt/me/security-question", version: "1" })
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get()
  @SecurityQuestionStatusDocs()
  status(@Req() req: AuthedRequest) {
    return this.mfa.status(req.user.id);
  }

  @Put()
  @SetSecurityQuestionDocs()
  set(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(setSecurityQuestionSchema)) body: SetSecurityQuestionDto) {
    return this.mfa.setQuestion(req.user.id, body.question, body.answer);
  }
}
