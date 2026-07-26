import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import { TLDS } from "../../core/common/tlds";
import { GeneralApi, GetGeneralDocs, GetTldsDocs, UpdateGeneralDocs } from "./general.openapi";
import { UpdateGeneralDto, updateGeneralSchema } from "./general.validation";

@GeneralApi()
@UseGuards(RootGuard)
@Controller({ path: "config/general", version: "1" })
export class GeneralController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  @GetGeneralDocs()
  get() {
    return { managerUrl: this.settings.get().managerUrl };
  }

  @Get("tlds")
  @GetTldsDocs()
  tlds() {
    return { tlds: [...TLDS] };
  }

  @Put()
  @UpdateGeneralDocs()
  async update(@Body(new ZodValidationPipe(updateGeneralSchema)) body: UpdateGeneralDto) {
    const view = await this.settings.update(body);
    return { managerUrl: view.managerUrl };
  }
}
