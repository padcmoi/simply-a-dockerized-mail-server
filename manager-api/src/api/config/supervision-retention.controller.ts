import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import {
  GetSupervisionRetentionDocs,
  SupervisionRetentionApi,
  UpdateSupervisionRetentionDocs,
} from "./supervision-retention.openapi";
import { UpdateSupervisionRetentionDto, updateSupervisionRetentionSchema } from "./supervision-retention.validation";

@SupervisionRetentionApi()
@UseGuards(RootGuard)
@Controller({ path: "config/supervision", version: "1" })
export class SupervisionRetentionController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  @GetSupervisionRetentionDocs()
  get() {
    return this.settings.get();
  }

  @Put()
  @UpdateSupervisionRetentionDocs()
  update(@Body(new ZodValidationPipe(updateSupervisionRetentionSchema)) body: UpdateSupervisionRetentionDto) {
    return this.settings.update(body);
  }
}
