import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ActivityLogService } from "../../core/activity/activity-log.service";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { PostfixSettingsService } from "../../core/postfix/postfix-settings.service";
import { postfixSettingsSchema, type PostfixSettingsDto } from "../../core/postfix/postfix-settings.validation";
import { GetPostfixConfigDocs, PostfixConfigApi, UpdatePostfixConfigDocs } from "./postfix-config.openapi";

@PostfixConfigApi()
@UseGuards(RootGuard)
@Controller({ path: "config/postfix", version: "1" })
export class PostfixConfigController {
  constructor(
    private readonly postfix: PostfixSettingsService,
    private readonly activity: ActivityLogService
  ) {}

  @Get()
  @GetPostfixConfigDocs()
  get() {
    return this.postfix.get();
  }

  @Put()
  @UpdatePostfixConfigDocs()
  async update(@Body(new ZodValidationPipe(postfixSettingsSchema)) body: PostfixSettingsDto) {
    const { view, changed } = await this.postfix.update(body);
    if (changed.length) {
      await this.activity.record({
        action: "postfix.settings-updated",
        entity: { type: "service", label: "postfix" },
        details: { fields: changed, version: view.version, ...view.settings },
      });
    }
    return view;
  }
}
