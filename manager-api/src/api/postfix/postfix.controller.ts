import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PostfixService } from "../../core/postfix/postfix.service";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { GetQueueDocs, PostfixApi } from "./postfix.openapi";

@PostfixApi()
@Controller({ path: "postfix", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class PostfixController {
  constructor(private readonly postfix: PostfixService) {}

  @RequireGlobalPermissions([{ resource: "postfix", actions: ["access", "view-postfix-queue"] }])
  @GetQueueDocs()
  @Get("queue")
  queue(@Query("domain") domain?: string) {
    return this.postfix.queueStats(domain);
  }
}
