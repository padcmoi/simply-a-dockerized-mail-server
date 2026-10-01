import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../../core/auth/auth.decorator";
import { LoopbackGuard } from "../../core/auth/loopback.guard";
import { ApiError } from "../../core/common/api-error";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { MailerService } from "../../core/mailer/mailer.service";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import { SendAlertDto, sendAlertSchema } from "./internal-alert.validation";

@ApiExcludeController()
@Public()
@UseGuards(LoopbackGuard)
@Controller({ path: "internal/alert", version: "1" })
export class InternalAlertController {
  private readonly log = new Logger(InternalAlertController.name);

  constructor(
    private readonly settings: AppSettingsService,
    private readonly mailer: MailerService
  ) {}

  @Post()
  @HttpCode(204)
  async send(@Body(new ZodValidationPipe(sendAlertSchema)) body: SendAlertDto) {
    const to = this.settings.get().adminAlertEmail;
    if (!to) throw new ApiError(HttpStatus.CONFLICT, "alert.noAddress", "No alert address is set in the manager");
    const sent = await this.mailer.sendNotification({ to, subject: body.subject, text: body.message });
    if (!sent) {
      throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "alert.tooSoon", "An alert was sent to this address moments ago", {
        intervalMs: this.settings.get().mailMinIntervalMs,
      });
    }
    this.log.log(`Alert sent to ${to}: ${body.subject}`);
  }
}
