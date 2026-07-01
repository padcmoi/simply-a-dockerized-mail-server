import { Module } from "@nestjs/common";
import { RspamdController } from "./rspamd.controller";

@Module({ controllers: [RspamdController] })
export class RspamdModule {}
