import { Body, Controller, Get, HttpStatus, Post, Put, Req, UseGuards } from "@nestjs/common";
import { randomInt } from "crypto";
import type { Request } from "express";
import { ApiError } from "../../core/common/api-error";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { MailerService } from "../../core/mailer/mailer.service";
import { MailSettingsService } from "../../core/mailer/mail-settings.service";
import {
  DisableMailConfigDocs,
  GetMailConfigDocs,
  MailConfigApi,
  SaveMailConfigDocs,
  SelectMailConfigDocs,
  TestMailConfigDocs,
  VerifyMailConfigDocs,
} from "./mail-config.openapi";
import {
  SaveMailConfigDto,
  SelectMailConfigDto,
  TestMailConfigDto,
  VerifyMailConfigDto,
  saveMailConfigSchema,
  selectMailConfigSchema,
  testMailConfigSchema,
  verifyMailConfigSchema,
} from "./mail-config.validation";

type AuthedRequest = Request & { user: { id: string; email: string; isRoot: boolean } };

@MailConfigApi()
@UseGuards(RootGuard)
@Controller({ path: "config/mail", version: "1" })
export class MailConfigController {
  constructor(
    private readonly settings: MailSettingsService,
    private readonly mailer: MailerService
  ) {}

  @Get()
  @GetMailConfigDocs()
  get() {
    return this.settings.list();
  }

  @Put()
  @SaveMailConfigDocs()
  update(@Body(new ZodValidationPipe(saveMailConfigSchema)) body: SaveMailConfigDto) {
    return this.settings.save(body);
  }

  @Post("test")
  @TestMailConfigDocs()
  async test(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(testMailConfigSchema)) body: TestMailConfigDto) {
    const cfg = await this.settings.configFor(body.provider);
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.mailer.sendWith(cfg, {
      to: req.user.email,
      subject: "Mail configuration verification code",
      text: `Your verification code is ${code}. Enter it on the mail configuration page to activate this provider.`,
    });
    await this.settings.setOtp(body.provider, code);
    return { ok: true };
  }

  @Post("verify")
  @VerifyMailConfigDocs()
  async verify(@Body(new ZodValidationPipe(verifyMailConfigSchema)) body: VerifyMailConfigDto) {
    const ok = await this.settings.verify(body.provider, body.otp);
    if (!ok) throw new ApiError(HttpStatus.BAD_REQUEST, "mail.otpInvalid", "Invalid verification code");
    return this.settings.list();
  }

  @Post("select")
  @SelectMailConfigDocs()
  async select(@Body(new ZodValidationPipe(selectMailConfigSchema)) body: SelectMailConfigDto) {
    await this.settings.select(body.provider);
    return this.settings.list();
  }

  @Post("disable")
  @DisableMailConfigDocs()
  async disable() {
    await this.settings.disable();
    return this.settings.list();
  }
}
