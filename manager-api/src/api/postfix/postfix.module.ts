import { Module } from "@nestjs/common";
import { PostfixCoreModule } from "../../core/postfix/postfix.module";
import { PostfixController } from "./postfix.controller";

@Module({ imports: [PostfixCoreModule], controllers: [PostfixController] })
export class PostfixModule {}
