import { Module } from "@nestjs/common";
import { PostfixService } from "./postfix.service";

@Module({ providers: [PostfixService], exports: [PostfixService] })
export class PostfixCoreModule {}
