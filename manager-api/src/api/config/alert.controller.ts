import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import { AlertApi, GetAlertDocs, UpdateAlertDocs } from "./alert.openapi";
import { UpdateAlertDto, updateAlertSchema } from "./alert.validation";

@AlertApi()
@UseGuards(RootGuard)
@Controller({ path: "config/alert", version: "1" })
export class AlertController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  @GetAlertDocs()
  get() {
    return { adminAlertEmail: this.settings.get().adminAlertEmail };
  }

  @Put()
  @UpdateAlertDocs()
  async update(@Body(new ZodValidationPipe(updateAlertSchema)) body: UpdateAlertDto) {
    const view = await this.settings.update(body);
    return { adminAlertEmail: view.adminAlertEmail };
  }
}
