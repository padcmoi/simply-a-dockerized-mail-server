import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from "@nestjs/common";
import { Public } from "../../core/auth/auth.decorator";
import { BRANDING_FILES, BrandingService, type BrandingKind } from "../../core/branding/branding.service";
import { BrandingApi, BrandingFileDocs, BrandingStateDocs } from "./branding.openapi";

@BrandingApi()
@Controller({ path: "branding", version: "1" })
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Public()
  @Get()
  @BrandingStateDocs()
  state() {
    return this.branding.state();
  }

  @Public()
  @Get(":kind")
  @Header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("Cache-Control", "public, max-age=300")
  @BrandingFileDocs()
  async file(@Param("kind") kind: string) {
    if (!Object.hasOwn(BRANDING_FILES, kind)) throw new NotFoundException("No such branding file");
    const file = await this.branding.open(kind as BrandingKind);
    if (!file) throw new NotFoundException("This server does not carry that custom file");
    return new StreamableFile(file.stream, { type: "image/svg+xml", length: file.size });
  }
}
