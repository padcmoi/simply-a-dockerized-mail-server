import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import { GetTicketsConfigDocs, TicketsConfigApi, UpdateTicketsConfigDocs } from "./tickets-config.openapi";
import { UpdateTicketsConfigDto, updateTicketsConfigSchema } from "./tickets-config.validation";

@TicketsConfigApi()
@UseGuards(RootGuard)
@Controller({ path: "config/tickets", version: "1" })
export class TicketsConfigController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  @GetTicketsConfigDocs()
  get() {
    return this.settings.get();
  }

  @Put()
  @UpdateTicketsConfigDocs()
  update(@Body(new ZodValidationPipe(updateTicketsConfigSchema)) body: UpdateTicketsConfigDto) {
    return this.settings.update(body);
  }
}
