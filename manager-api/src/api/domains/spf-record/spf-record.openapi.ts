import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const SpfRecordApi = () =>
  applyDecorators(
    ApiTags("domain-spf-record"),
    ApiSecurity("apiToken"),
    ApiParam({ name: "domainId", type: Number, description: "Parent virtual_domains.id" })
  );

export const SpfRecordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The SPF TXT record to publish for this domain, ready to copy",
      description:
        "`txtRecord` is the value to publish at `dnsName`, the domain itself, so the addresses of `mailHost` (`ips`, what the mail host " +
        "name of this server resolves to) may send for it. When an SPF record is already published, every mechanism it lists is kept " +
        "and the missing `ip4:` terms are put in front of them; otherwise it is `v=spf1 mx ip4:<address> -all`. `published` is the " +
        "first SPF record DNS answers today, null when there is none (`error` then says why), `multiple` whether DNS answers more than " +
        "one (which makes SPF fail), and `covered` whether the published record already authorizes every address of the server, " +
        "through `ip4`, `a` or `mx`.",
    }),
    ApiResponse({
      status: 200,
      description: "The record",
      schema: {
        example: {
          dnsName: "example.com",
          txtRecord: "v=spf1 ip4:203.0.113.10 include:_spf.example.net ~all",
          mailHost: "mail.example.com",
          ips: ["203.0.113.10"],
          published: "v=spf1 include:_spf.example.net ~all",
          multiple: false,
          covered: false,
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
