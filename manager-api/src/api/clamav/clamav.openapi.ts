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

const updateExample = {
  updated: false,
  output: [
    "Sun Sep 20 13:57:40 2026 -> daily.cld database is up-to-date (version: 28129, sigs: 355666, f-level: 90, builder: svc.clamav-publisher)",
  ],
  status: statusExample,
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

export const ClamavUpdateDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Ask the scanner to fetch the signatures published right now",
      description:
        "Runs freshclam inside the scanner's own container, which is the only place allowed to write its signature directory, and waits for it: a full download is minutes, not seconds. " +
        "`output` is freshclam's own last forty lines, `updated` whether it downloaded anything at all. When it did, clamd is told to read the new set before this answers, " +
        "and `status` is the same payload as GET /clamav/status, already taken after the update. Recorded in the activity journal.",
    }),
    ApiResponse({
      status: 200,
      description: "What freshclam did, and the scanner's state after it",
      schema: { example: updateExample },
    }),
    ApiResponse({
      status: 403,
      description: "Missing the `clamav:access` and/or `clamav:update-signatures` global permission",
      schema: { example: { statusCode: 403, message: "Missing permission clamav:update-signatures", error: "Forbidden" } },
    }),
    ApiResponse({
      status: 409,
      description: "An update is already running, started by this route or by freshclam's own daemon",
      schema: { example: { statusCode: 409, message: "An update is already running", error: "Conflict" } },
    }),
    ApiResponse({
      status: 503,
      description: "The updater in the scanner's container is out of reach, or freshclam failed",
      schema: { example: { statusCode: 503, message: "The antivirus updater is out of reach", error: "Service Unavailable" } },
    })
  );

export const ClamavReloadDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Tell the scanner to read its signature directory again",
      description:
        "clamd keeps scanning with the set it has in memory until it is told to read the files again. freshclam's own daemon says so after every download it makes, " +
        "which a scanner that was down at that moment never heard. `status` is the same payload as GET /clamav/status. Recorded in the activity journal.",
    }),
    ApiResponse({
      status: 200,
      description: "The scanner's state after the reload",
      schema: { example: { status: statusExample } },
    }),
    ApiResponse({
      status: 403,
      description: "Missing the `clamav:access` and/or `clamav:reload-database` global permission",
      schema: { example: { statusCode: 403, message: "Missing permission clamav:reload-database", error: "Forbidden" } },
    }),
    ApiResponse({
      status: 503,
      description: "clamd is out of reach",
      schema: { example: { statusCode: 503, message: "The antivirus is out of reach", error: "Service Unavailable" } },
    })
  );
