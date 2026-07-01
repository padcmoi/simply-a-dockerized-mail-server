import { Module } from "@nestjs/common";
import { RspamdService } from "./rspamd.service";

@Module({ providers: [RspamdService], exports: [RspamdService] })
export class RspamdCoreModule {}
