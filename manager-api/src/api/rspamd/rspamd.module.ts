import { Module } from "@nestjs/common";
import { RspamdCoreModule } from "../../core/rspamd/rspamd.module";
import { RspamdController } from "./rspamd.controller";

@Module({ imports: [RspamdCoreModule], controllers: [RspamdController] })
export class RspamdModule {}
