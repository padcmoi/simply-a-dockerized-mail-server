import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetStatsDocs, RspamdApi } from "./rspamd.openapi";

interface RspamdActions {
  reject: number;
  "soft reject": number;
  "rewrite subject": number;
  "add header": number;
  greylist: number;
  "no action": number;
}

export interface RspamdStats {
  version: string;
  uptime: number;
  scanned: number;
  learned: number;
  spam_count: number;
  ham_count: number;
  connections: number;
  actions: RspamdActions;
}

@RspamdApi()
@Controller({ path: "rspamd", version: "1" })
export class RspamdController {
  private readonly baseUrl: string;

  constructor(cfg: ConfigService) {
    this.baseUrl = cfg.get<string>("RSPAMD_API_URL") ?? "http://mail-rspamd:11334";
  }

  @GetStatsDocs()
  @Get("stats")
  async stats(): Promise<RspamdStats> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/stat`);
    } catch {
      throw new HttpException("Rspamd unreachable", HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!res.ok) {
      throw new HttpException(`Rspamd returned ${res.status}`, HttpStatus.BAD_GATEWAY);
    }
    return res.json() as Promise<RspamdStats>;
  }
}
