import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

export const BrandingApi = () => applyDecorators(ApiTags("branding"));

export const BrandingStateDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Tell whether this server carries its own icon, logo and favicon",
      description:
        "Public on purpose: the sign-in screen shows the logo, and the interface's own server asks before rendering the first page. " +
        "The files are `custom-mail-icon.svg`, `custom-mail-logo.svg` and `custom-mail-favicon.svg` at the root of the volumes folder, " +
        "each a plain file of at most 512 KB. The API puts there, when it starts, a copy of the marks the interface ships with; a copy nobody replaced " +
        "is not a custom mark. `custom` is true when the icon and the logo are both there and one at least was replaced; `version` " +
        "changes whenever one of the two does, so a replaced file is not served from a cache. `favicon` stands on its own: it carries " +
        "the version of the favicon once that file was replaced, and null while the browser tab keeps the icon the interface ships with.",
    }),
    ApiResponse({ status: 200, schema: { example: { custom: true, version: "3f9a1c0b7d2e", favicon: "9c41d2aa07be" } } })
  );

export const BrandingFileDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Serve the custom icon, logo or favicon of this server",
      description:
        "Public, like the sign-in screen that shows it. Served as `image/svg+xml` under a sandboxing content security policy, so a " +
        "script written into the file runs nowhere, not even when the address is opened on its own.",
    }),
    ApiParam({ name: "kind", enum: ["icon", "logo", "favicon"] }),
    ApiResponse({ status: 200, description: "The SVG file" }),
    ApiResponse({ status: 404, description: "Unknown kind, or this server does not carry that custom file" })
  );
