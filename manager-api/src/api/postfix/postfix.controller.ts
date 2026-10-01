import { BadRequestException, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ActivityLogService } from "../../core/activity/activity-log.service";
import {
  PostfixCommandsService,
  QUEUE_ID_PATTERN,
  RETRYABLE_QUEUES,
  type RetryableQueue,
} from "../../core/postfix/postfix-commands.service";
import { PostfixService, QUEUE_NAMES, type QueueName } from "../../core/postfix/postfix.service";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { GetQueueDocs, GetQueueMessagesDocs, PostfixApi, PurgeQueueMessageDocs, RetryQueueMessageDocs } from "./postfix.openapi";

@PostfixApi()
@Controller({ path: "postfix", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class PostfixController {
  constructor(
    private readonly postfix: PostfixService,
    private readonly commands: PostfixCommandsService,
    private readonly activity: ActivityLogService
  ) {}

  @RequireGlobalPermissions([{ resource: "postfix", actions: ["access", "view-postfix-queue"] }])
  @GetQueueDocs()
  @Get("queue")
  queue(@Query("domain") domain?: string) {
    return this.postfix.queueStats(domain);
  }

  @RequireGlobalPermissions([{ resource: "postfix", actions: ["access", "view-postfix-queue"] }])
  @GetQueueMessagesDocs()
  @Get("queue/:queue/messages")
  messages(@Param("queue") queue: string) {
    return this.postfix.queueMessages(this.queueOf(queue));
  }

  @RequireGlobalPermissions([{ resource: "postfix", actions: ["access", "purge-postfix-queue-message"] }])
  @PurgeQueueMessageDocs()
  @Delete("queue/:queue/messages/:id")
  @HttpCode(204)
  async purge(@Param("queue") queue: string, @Param("id") id: string) {
    const name = this.queueOf(queue);
    if (!QUEUE_ID_PATTERN.test(id)) throw new BadRequestException("Invalid queue id");
    await this.commands.deleteMessage(name, id);
    await this.activity.record({
      action: "postfix.message-purged",
      entity: { type: "postfix-message", id, label: id },
      details: { queue: name },
    });
  }

  @RequireGlobalPermissions([{ resource: "postfix", actions: ["access", "retry-postfix-queue-message"] }])
  @RetryQueueMessageDocs()
  @Post("queue/:queue/messages/:id/retry")
  @HttpCode(204)
  async retry(@Param("queue") queue: string, @Param("id") id: string) {
    if (!(RETRYABLE_QUEUES as readonly string[]).includes(queue)) throw new BadRequestException("This queue cannot be retried");
    if (!QUEUE_ID_PATTERN.test(id)) throw new BadRequestException("Invalid queue id");
    await this.commands.retryMessage(queue as RetryableQueue, id);
    await this.activity.record({
      action: "postfix.message-retried",
      entity: { type: "postfix-message", id, label: id },
      details: { queue },
    });
  }

  private queueOf(queue: string): QueueName {
    if (!(QUEUE_NAMES as readonly string[]).includes(queue)) throw new BadRequestException("Unknown queue");
    return queue as QueueName;
  }
}
