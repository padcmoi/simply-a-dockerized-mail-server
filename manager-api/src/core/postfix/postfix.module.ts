import { Module } from "@nestjs/common";
import { PostfixCommandsService } from "./postfix-commands.service";
import { PostfixService } from "./postfix.service";

@Module({ providers: [PostfixService, PostfixCommandsService], exports: [PostfixService, PostfixCommandsService] })
export class PostfixCoreModule {}
