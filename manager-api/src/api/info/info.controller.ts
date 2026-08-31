import { Controller, Get } from "@nestjs/common";
import { Public } from "../../core/auth/auth.decorator";
import { GetInfoDocs, InfoApi } from "./info.openapi";
import { InfoService } from "./info.service";

@Public()
@InfoApi()
@Controller({ path: "", version: "1" })
export class InfoController {
  constructor(private readonly svc: InfoService) {}

  @Get()
  @GetInfoDocs()
  get() {
    return { code_version: this.svc.codeVersion() };
  }
}
