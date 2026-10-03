import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery, paginatedExample } from "../../core/common/pagination.openapi";

export const BackupsApi = () => applyDecorators(ApiTags("backups"));

const runExample = {
  id: 12,
  startedAt: "2026-10-02T02:30:01.000Z",
  finishedAt: "2026-10-02T02:30:56.000Z",
  result: "success",
  step: "done",
  error: "",
  durationSeconds: 55,
  outageSeconds: 28,
  archive: "backup-2026-10-02.tar.gz",
  archiveBytes: 212731507,
  storedIn: "/srv/mailserver/backup",
  offsiteTarget: "",
  offsiteSent: 0,
};

const configExample = { time: "02:30", keepDays: 5, offsite: "backup@backup.example.com:/srv/mail", offsiteDeleteLocal: true };

const stateExample = {
  configured: true,
  config: { ...configExample, dir: "./backup", timezone: "Europe/Paris", publishedAt: "2026-10-01T14:24:00Z" },
  pending: false,
  lastRequest: { state: "applied", error: "", at: "2026-10-01T15:02:00Z" },
};

const retrievalExample = {
  pending: { id: "0b8f6f0e-5a55-4c5e-9d7b-2f3a1c9e7d10", name: "backup-2026-10-02.tar.gz" },
  last: null,
};

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const BackupOverviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Backup overview: configuration, pending change, last run",
      description:
        "Root only, like every backup route. `configured` is false, and `config` null, until the backup is installed on the server " +
        "with `./backup.sh`: the manager never installs nor removes it. `projectReadable` is false when the manager cannot look at " +
        "the folders of the server, in which case no archive can be checked nor downloaded. `retrieval` tells which archive the server " +
        "is opening on the off-site server, and where the last one stands: `ready` to be downloaded, `done` or `error`. `offsite` tells " +
        "when the host last listed the off-site server over ssh, whether it could, and whether a new listing is `pending`.",
    }),
    ApiResponse({
      status: 200,
      schema: {
        example: {
          ...stateExample,
          lastRun: runExample,
          projectReadable: true,
          retrieval: { pending: null, last: null },
          offsite: { pending: false, target: configExample.offsite, listed: true, checkedAt: "2026-10-02T22:31:00Z" },
        },
      },
    }),
    RootOnly()
  );

export const BackupRunsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List the backup runs the server reported, newest first" }),
    ApiPaginationQuery(["startedAt", "result", "durationSeconds", "outageSeconds", "archiveBytes"]),
    ApiResponse({ status: 200, schema: { example: paginatedExample(runExample) } }),
    RootOnly()
  );

export const BackupRunLogDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Read the log lines of one backup run" }),
    ApiParam({ name: "id", example: 12 }),
    ApiResponse({
      status: 200,
      schema: { example: { id: 12, startedAt: runExample.startedAt, lines: ["2026-10-02T02:30:01Z backup started"] } },
    }),
    ApiResponse({ status: 404, description: "No such run" }),
    RootOnly()
  );

export const BackupFilesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List the backup archives the server knows about",
      description:
        "One row per archive, with the place the database holds for it: `localDir`, its folder on the server, and " +
        "`localProjectDir`, that folder inside the project when it lies in it. Presence is not remembered, it is looked up: at every call " +
        "each archive is searched at that place. One whose file or whole folder was moved away or deleted is recorded as deleted, " +
        "one that is back is recorded as present, and `downloadable` is true only when the file is there. " +
        "`verifiable` is false for an archive kept outside the project, which keeps what the last backup reported. " +
        "`retrievable` is true for an archive that is not on the server anymore but is still kept off-site: " +
        "`POST /backups/files/:name/retrieve` opens it there, to be downloaded straight from the other server. " +
        "`offsitePresent` is what the host found when it last listed the off-site server over ssh, at `offsiteCheckedAt`: " +
        "true when the archive is there, false when it was sent but is not there anymore, null when it was never sent, " +
        "could not be checked, or was sent after that listing, which then says nothing of it. Listing the archives asks the host " +
        "for a new listing when the last one is older than a minute or older than the last archive sent; `offsiteChecking` is true " +
        "on the archives that listing is awaited for, so null with `offsiteChecking` means not known yet, never absent.",
    }),
    ApiResponse({
      status: 200,
      schema: {
        example: [
          {
            name: "backup-2026-10-02.tar.gz",
            bytes: 212731507,
            createdAt: "2026-10-02T02:30:56.000Z",
            localDir: "/srv/mailserver/backup",
            localProjectDir: "backup",
            localPresent: 1,
            localDeletedAt: null,
            offsiteTarget: "",
            offsiteSentAt: null,
            offsiteDeletedAt: null,
            verifiable: true,
            downloadable: true,
            retrievable: false,
            offsitePresent: null,
            offsiteCheckedAt: null,
            offsiteChecking: false,
          },
        ],
      },
    }),
    RootOnly()
  );

export const BackupDownloadLinkDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get a one-minute link to download a backup archive",
      description:
        "An archive holds every mailbox and every secret of the server. The link is signed, names one archive and " +
        "expires after a minute; it is opened without a token, so the browser can save the file as it comes. An archive that is only " +
        "kept off-site gets a link once `POST /backups/files/:name/retrieve` is answered `ready`. Recorded in the activity journal.",
    }),
    ApiParam({ name: "name", example: "backup-2026-10-02.tar.gz" }),
    ApiResponse({ status: 201, schema: { example: { token: "YmFja3Vw...", expiresInSeconds: 60 } } }),
    ApiResponse({ status: 404, description: "No such archive on the server" }),
    RootOnly()
  );

export const RetrieveBackupFileDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Ask the server to open an archive that was sent off-site, to download it from there",
      description:
        "An archive sent off-site and deleted from the server is downloaded straight from the other server, which only root on the host " +
        "reaches. manager-api writes the request in the folder it shares with the host; `scripts/backup.apply.sh`, started every minute " +
        "by the backup cron entry, checks the name and the place again, reads the archive on the other server over ssh into a pipe and " +
        "answers `ready`. The download link then serves that pipe: nothing is written on this server, the archive is not brought back. " +
        "Until the answer, `pending` names it. One request gives one download, one archive at a time. Recorded in the activity journal.",
    }),
    ApiParam({ name: "name", example: "backup-2026-10-02.tar.gz" }),
    ApiResponse({ status: 201, schema: { example: retrievalExample } }),
    ApiResponse({ status: 404, description: "No such archive, or it is not kept off-site (`backup.fileUnavailable`)" }),
    ApiResponse({
      status: 409,
      description:
        "The backup is not installed on the server (`backup.notConfigured`), or another archive is being downloaded from off-site (`backup.retrievalBusy`)",
    }),
    RootOnly()
  );

export const BackupDownloadDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Download a backup archive with a link from `POST /backups/files/:name/download-link`" }),
    ApiParam({ name: "token" }),
    ApiResponse({ status: 200, description: "The archive, as `application/gzip`" }),
    ApiResponse({ status: 404, description: "Invalid or expired link, or archive gone" })
  );

export const UpdateBackupConfigDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Ask the server to change the backup configuration",
      description:
        "manager-api writes the request in the folder it shares with the host; `scripts/backup.apply.sh`, started every minute " +
        "by the backup cron entry, checks every value again, rewrites `backup.conf` and the cron entry, and answers. Until then `pending` is true. " +
        "The folder of the archives cannot be changed from here, and the backup can neither be installed nor removed from the manager.",
    }),
    ApiBody({ schema: { example: configExample } }),
    ApiResponse({ status: 200, schema: { example: { ...stateExample, pending: true } } }),
    ApiResponse({ status: 400, description: "Invalid time, number of backups kept or off-site destination" }),
    ApiResponse({ status: 409, description: "The backup is not installed on the server (`backup.notConfigured`)" }),
    RootOnly()
  );
