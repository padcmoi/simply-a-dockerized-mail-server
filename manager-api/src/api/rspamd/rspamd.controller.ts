import { Controller, Get } from "@nestjs/common";
import type { RspamdStats } from "../../core/rspamd/rspamd.service";
import { RspamdService } from "../../core/rspamd/rspamd.service";
import { GetStatsDocs, RspamdApi } from "./rspamd.openapi";

export type { RspamdStats };

@RspamdApi()
@Controller({ path: "rspamd", version: "1" })
export class RspamdController {
  constructor(private readonly rspamd: RspamdService) {}

  @GetStatsDocs()
  @Get("stats")
  stats() {
    return this.rspamd.stats();
  }
}
