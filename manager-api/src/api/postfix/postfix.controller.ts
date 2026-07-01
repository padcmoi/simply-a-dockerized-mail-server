import { Controller, Get, Query } from "@nestjs/common";
import { GetQueueDocs, PostfixApi } from "./postfix.openapi";
import { PostfixService } from "./postfix.service";

@PostfixApi()
@Controller({ path: "postfix", version: "1" })
export class PostfixController {
  constructor(private readonly postfix: PostfixService) {}

  @GetQueueDocs()
  @Get("queue")
  async queue(@Query("domain") domain?: string) {
    return this.postfix.queueStats(domain);
  }
}
