import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const DmarcRecordApi = () =>
  applyDecorators(
    ApiTags("domain-dmarc-record"),
    ApiSecurity("apiToken"),
    ApiParam({ name: "domainId", type: Number, description: "Parent virtual_domains.id" })
  );

export const DmarcRecordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The DMARC TXT record to publish for this domain, ready to copy",
      description:
        "`txtRecord` is the value to publish at `dnsName` so the aggregate reports other providers send about this domain reach " +
        "`mailbox`, the dmarc_reports@ mailbox every domain is given. When a DMARC record is already published, its policy and " +
        "tags are kept and only the rua address is added in front of the ones it lists; otherwise it is a monitoring policy " +
        "(`p=none`). `published` is what DNS answers today, null when nothing resolves (`error` then says why), and `reportsHere` " +
        "whether that published record already sends its reports to the mailbox.",
    }),
    ApiResponse({
      status: 200,
      description: "The record",
      schema: {
        example: {
          dnsName: "_dmarc.example.com",
          txtRecord: "v=DMARC1; p=quarantine; rua=mailto:dmarc_reports@example.com; adkim=r; aspf=r",
          mailbox: "dmarc_reports@example.com",
          published: "v=DMARC1; p=quarantine; adkim=r; aspf=r",
          reportsHere: false,
          error: null,
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: "Missing the `admin:access` and/or `admin:view-admin-page` permission on this domain",
    }),
    ApiResponse({ status: 404, description: "No domain with this id" })
  );
