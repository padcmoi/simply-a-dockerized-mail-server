import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery } from "../../core/common/pagination.openapi";
import {
  DMARC_INBOX_SEARCHABLE,
  DMARC_INBOX_SORTABLE,
  DMARC_INBOX_STATUSES,
  DMARC_INCOMING_SEARCHABLE,
  DMARC_INCOMING_SORTABLE,
  DMARC_OUTGOING_SEARCHABLE,
  DMARC_OUTGOING_SORTABLE,
  DMARC_OUTGOING_STATUSES,
} from "../../core/dmarc/dmarc.validation";

export const DmarcApi = () => applyDecorators(ApiTags("dmarc"), ApiSecurity("apiToken"));

const forbidden = (action: string) =>
  ApiResponse({
    status: 403,
    description: `Missing the \`dmarc:access\` and/or \`dmarc:${action}\` global permission`,
    schema: { example: { statusCode: 403, message: "Missing permission dmarc:access", error: "Forbidden" } },
  });

const notFound = () =>
  ApiResponse({
    status: 404,
    description: "No DMARC report with this id",
    schema: { example: { statusCode: 404, message: "No such DMARC report" } },
  });

const idParam = () => ApiParam({ name: "id", type: Number, example: 1 });

const settingsExample = { sendingEnabled: true, reportHour: 2, inboxes: ["dmarc@example.com"], retentionDays: 90 };

const runExample = { day: "2026-09-20", domains: 3, sent: 4, failed: 0, skipped: 1, unchanged: 0 };
const scanExample = { mailboxes: 1, scanned: 6, imported: 5, duplicates: 0, ignored: 1, failed: 0, deleted: 5 };

const incomingExample = {
  id: 1,
  orgName: "google.com",
  orgEmail: "noreply-dmarc-support@google.com",
  extraContact: null,
  reportId: "1234567890123456789",
  domain: "example.com",
  periodBegin: 1789862400,
  periodEnd: 1789948799,
  adkim: "r",
  aspf: "r",
  p: "quarantine",
  sp: "quarantine",
  pct: 100,
  records: 2,
  messages: 18,
  dmarcPass: 17,
  dkimPass: 17,
  spfPass: 16,
  mailbox: "dmarc@example.com",
  receivedAt: "2026-09-21T06:12:00.000Z",
};

const outgoingExample = {
  id: 1,
  reportId: "partner.org:example.com:1789862400",
  reporterDomain: "example.com",
  policyDomain: "partner.org",
  recipient: "dmarc@partner.org",
  periodBegin: 1789862400,
  periodEnd: 1789948799,
  records: 2,
  messages: 7,
  sizeBytes: 612,
  status: "sent",
  reason: null,
  attempts: 1,
  createdAt: "2026-09-21T02:00:04.000Z",
  sentAt: "2026-09-21T02:00:05.000Z",
};

export const DmarcOverviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Where DMARC reporting stands on this server, over the last thirty days",
      description:
        "`ingest` is the milter's history read into the database: when it last ran, how many evaluations it read then, and how many messages were evaluated over the last day. " +
        "`outgoing` counts the aggregate reports this server sent to other domains by status, `inbox` the messages read from the report mailboxes by outcome, " +
        "and `domains` sums, per domain, the reports other providers sent about it.",
    }),
    ApiResponse({ status: 200, description: "The overview" }),
    forbidden("view-dmarc-reports")
  );

export const DmarcIncomingDocs = () =>
  applyDecorators(
    ApiPaginationQuery(DMARC_INCOMING_SORTABLE, DMARC_INCOMING_SEARCHABLE),
    ApiQuery({ name: "domain", required: false, description: "Keep only the reports about this domain" }),
    ApiOperation({
      summary: "The aggregate reports other providers sent about this server's domains",
      description:
        "Read from the report mailboxes. `dmarcPass` counts the messages that passed DKIM or SPF alignment, `dkimPass` and `spfPass` each on its own.",
    }),
    ApiResponse({
      status: 200,
      description: "A page of received reports",
      schema: { example: { items: [incomingExample], total: 1 } },
    }),
    forbidden("view-dmarc-reports")
  );

export const DmarcIncomingReportDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "One received report and each of its rows: a sending address, how many messages, and how they fared",
    }),
    ApiResponse({ status: 200, description: "The report and its rows" }),
    forbidden("view-dmarc-reports"),
    notFound()
  );

export const DmarcIncomingXmlDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({ summary: "The XML of a received report, exactly as it was sent" }),
    ApiResponse({
      status: 200,
      description: "The file name and the XML",
      schema: { example: { filename: "google.com!123.xml", xml: "<?xml ..." } },
    }),
    forbidden("view-dmarc-reports"),
    notFound()
  );

export const DmarcOutgoingDocs = () =>
  applyDecorators(
    ApiPaginationQuery(DMARC_OUTGOING_SORTABLE, DMARC_OUTGOING_SEARCHABLE),
    ApiQuery({ name: "domain", required: false, description: "Keep only the reports this hosted domain sent" }),
    ApiQuery({ name: "status", required: false, enum: DMARC_OUTGOING_STATUSES }),
    ApiOperation({
      summary: "The aggregate reports this server sent to the domains it received mail from",
      description:
        "One row per report and recipient. `reporterDomain` is the hosted domain that received the mail and sent the report, from its dmarc_reports mailbox. `skipped` carries its reason: `too-large` when the recipient's size limit was below the report, " +
        "`not-authorized` when the recipient sits in another domain that does not publish the `_report._dmarc` record authorizing it.",
    }),
    ApiResponse({
      status: 200,
      description: "A page of sent reports",
      schema: { example: { items: [outgoingExample], total: 1 } },
    }),
    forbidden("view-dmarc-reports")
  );

export const DmarcOutgoingXmlDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({ summary: "The XML of a report this server sent" }),
    ApiResponse({ status: 200, description: "The file name and the XML" }),
    forbidden("view-dmarc-reports"),
    notFound()
  );

export const DmarcRunDocs = () =>
  applyDecorators(
    ApiBody({ required: false, schema: { example: { day: "2026-09-20" } } }),
    ApiOperation({
      summary: "Build and send the reports of one day now",
      description:
        "The day defaults to yesterday, in UTC, and has to be over. A recipient that already received the report of that day is not sent it again. Recorded in the activity journal.",
    }),
    ApiResponse({ status: 200, description: "What was sent", schema: { example: runExample } }),
    ApiResponse({ status: 400, description: "The day is not over yet, or is not a date" }),
    forbidden("send-dmarc-reports")
  );

export const DmarcRetryDocs = () =>
  applyDecorators(
    idParam(),
    ApiOperation({
      summary: "Send a report that failed or was skipped again",
      description: "A report already sent, or skipped for its size, is answered as it is. Recorded in the activity journal.",
    }),
    ApiResponse({ status: 200, description: "The report row after the attempt", schema: { example: outgoingExample } }),
    forbidden("send-dmarc-reports"),
    notFound()
  );

export const DmarcInboxDocs = () =>
  applyDecorators(
    ApiPaginationQuery(DMARC_INBOX_SORTABLE, DMARC_INBOX_SEARCHABLE),
    ApiQuery({ name: "status", required: false, enum: DMARC_INBOX_STATUSES }),
    ApiOperation({
      summary: "Every message read from the report mailboxes, and what came of it",
      description:
        "`imported` carried at least one new report, `duplicate` only reports already stored, `not-a-report` none at all, `failed` a report that could not be read.",
    }),
    ApiResponse({ status: 200, description: "A page of read messages" }),
    forbidden("view-dmarc-reports")
  );

export const DmarcScanDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read the report mailboxes now instead of waiting for the next pass",
      description:
        "Recorded in the activity journal. In each `dmarc_reports@` mailbox, every mail read is then deleted over IMAP, " +
        "a report or not, its trace staying in the inbox log and a report's data in the database; `deleted` counts them. " +
        "The mails of an extra inbox from the settings are never deleted.",
    }),
    ApiResponse({ status: 200, description: "What the pass found", schema: { example: scanExample } }),
    forbidden("import-dmarc-reports")
  );

export const DmarcSettingsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "How DMARC reporting is set up" }),
    ApiResponse({ status: 200, description: "The settings", schema: { example: settingsExample } }),
    forbidden("manage-dmarc-settings")
  );

export const DmarcUpdateSettingsDocs = () =>
  applyDecorators(
    ApiBody({ schema: { example: settingsExample } }),
    ApiOperation({
      summary: "Change how DMARC reporting is set up",
      description:
        "`reportHour` is the hour of the server's clock after which yesterday's reports are sent. Each hosted domain signs and sends the reports about the mail it received " +
        "from its own dmarc_reports mailbox. `inboxes` are mailboxes of this server, read for the reports other providers send. Recorded in the activity journal.",
    }),
    ApiResponse({ status: 200, description: "The settings as saved", schema: { example: settingsExample } }),
    ApiResponse({ status: 400, description: "A value out of range, or an inbox that is not a mailbox of this server" }),
    forbidden("manage-dmarc-settings")
  );

export const DmarcMailboxesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "The mailboxes of this server that can be read for reports" }),
    ApiResponse({ status: 200, description: "Their addresses", schema: { example: ["dmarc@example.com"] } }),
    forbidden("manage-dmarc-settings")
  );
