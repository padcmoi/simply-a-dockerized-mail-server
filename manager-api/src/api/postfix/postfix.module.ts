import { Module } from "@nestjs/common";
import { PostfixController } from "./postfix.controller";
import { PostfixService } from "./postfix.service";

@Module({ controllers: [PostfixController], providers: [PostfixService] })
export class PostfixModule {}
