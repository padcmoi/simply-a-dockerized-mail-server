import { Controller, Get, Query } from "@nestjs/common";
import { PostfixService } from "../../core/postfix/postfix.service";
import { GetQueueDocs, PostfixApi } from "./postfix.openapi";

@PostfixApi()
@Controller({ path: "postfix", version: "1" })
export class PostfixController {
  constructor(private readonly postfix: PostfixService) {}

  @GetQueueDocs()
  @Get("queue")
  queue(@Query("domain") domain?: string) {
    return this.postfix.queueStats(domain);
  }
}
