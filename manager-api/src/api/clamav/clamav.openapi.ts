import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const ClamavApi = () => applyDecorators(ApiTags("clamav"), ApiSecurity("apiToken"));

const statusExample = {
  available: true,
  engine: { version: "1.4.6", published: "1.4.6", outdated: false },
  signaturesAt: 1789885560000,
  databases: [
    {
      name: "main",
      file: "main.cvd",
      version: 63,
      builtAt: 1765926 * 1000000,
      signatures: 3287027,
      bytes: 89072577,
      published: 63,
      behind: 0,
    },
  ],
  stats: { threadsLive: 1, threadsIdle: 0, threadsMax: 12, queue: 0, poolsUsed: 1014689075 },
};

export const ClamavStatusDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "What the virus scanner runs, and how current the signatures it was given are",
      description:
        "Three sources in one answer. `available`, `engine.version` and `stats` come from clamd over its own socket, and are null or false while it is out of reach. " +
        "`databases` are the signature files themselves, read from the directory freshclam writes: `version` and `signatures` are the ones in the file's header, " +
        "`builtAt` epoch milliseconds. `published` and `engine.published` are what ClamAV publishes right now, read from its `current.cvd.clamav.net` record and held " +
        "ten minutes, null while that lookup fails. `behind` is how many versions a database is short of the published one, and `signaturesAt` the newest build date of the three.",
    }),
    ApiResponse({ status: 200, description: "The scanner's state", schema: { example: statusExample } }),
    ApiResponse({
      status: 403,
      description: "Missing the `clamav:access` and/or `clamav:view-clamav-status` global permission",
      schema: { example: { statusCode: 403, message: "Missing permission clamav:access", error: "Forbidden" } },
    })
  );
