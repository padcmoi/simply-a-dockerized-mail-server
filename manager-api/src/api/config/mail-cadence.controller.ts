import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import { GetMailCadenceDocs, MailCadenceApi, UpdateMailCadenceDocs } from "./mail-cadence.openapi";
import { UpdateMailCadenceDto, updateMailCadenceSchema } from "./mail-cadence.validation";

@MailCadenceApi()
@UseGuards(RootGuard)
@Controller({ path: "config/mail-cadence", version: "1" })
export class MailCadenceController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  @GetMailCadenceDocs()
  get() {
    return this.settings.get();
  }

  @Put()
  @UpdateMailCadenceDocs()
  update(@Body(new ZodValidationPipe(updateMailCadenceSchema)) body: UpdateMailCadenceDto) {
    return this.settings.update(body);
  }
}
