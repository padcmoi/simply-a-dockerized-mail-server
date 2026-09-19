import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";

export const Fail2banApi = () => applyDecorators(ApiTags("fail2ban"), ApiSecurity("apiToken"));

const jailExample = {
  name: "dovecot",
  currentlyFailed: 2,
  totalFailed: 41,
  currentlyBanned: 1,
  totalBanned: 7,
  bantime: 3600,
  findtime: 300,
  maxretry: 5,
  bans: [{ ip: "203.0.113.9", bannedAt: 1789835049000, expiresAt: 1789838649000 }],
};

const historyExample = {
  jail: "dovecot",
  ip: "203.0.113.9",
  bannedAt: 1789835049000,
  expiresAt: 1789838649000,
  banCount: 1,
  failures: 5,
  matches: [
    "Sep 19 16:23:09 imap-login: Info: Disconnected: Auth failed (auth failed, 1 attempts in 2 secs): user=<a@example.com>, rip=203.0.113.9",
  ],
};

const forbidden = (action: string) =>
  ApiResponse({
    status: 403,
    description: `Missing the \`fail2ban:access\` and/or \`fail2ban:${action}\` global permission`,
    schema: { example: { statusCode: 403, message: "Missing permission fail2ban:access", error: "Forbidden" } },
  });

const unreachable = ApiResponse({
  status: 503,
  description: "The fail2ban sidecar is out of reach",
  schema: { example: { statusCode: 503, message: "Fail2ban is out of reach", error: "Service Unavailable" } },
});

export const Fail2banStatusDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Every fail2ban jail, its counters, its settings and the addresses it bans",
      description:
        "Read from the fail2ban container through its internal sidecar. `bantime` and `findtime` are seconds, " +
        "`bannedAt` and `expiresAt` epoch milliseconds, `expiresAt` null for a permanent ban. `available` is false, " +
        "with no jail, when fail2ban is out of reach. `history` is read from fail2ban's own sqlite database, newest " +
        "first and capped at 200: every ban it still keeps, expired ones included, with the log lines that caused it. " +
        "The websocket topic `fail2ban` carries the same payload.",
    }),
    ApiResponse({
      status: 200,
      description: "The jails.",
      schema: { example: { available: true, jails: [jailExample], history: [historyExample] } },
    }),
    forbidden("view-fail2ban-jails")
  );

const ipBody = ApiBody({
  schema: { type: "object", required: ["ip"], properties: { ip: { type: "string", example: "203.0.113.9" } } },
});

const failures = (action: string) =>
  applyDecorators(
    ApiResponse({
      status: 400,
      description: "Invalid jail name or address",
      schema: { example: { statusCode: 400, message: "Invalid address", error: "Bad Request" } },
    }),
    forbidden(action),
    unreachable
  );

export const BanIpDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Ban an address for good",
      description:
        "The ban goes into the `manager` jail, whose bantime is -1: it lasts until it is lifted, unlike the bans " +
        "the automatic jails hand out, which keep their own duration. The jail covers every mail port.",
    }),
    ipBody,
    ApiResponse({
      status: 200,
      description: "The manager jail after the ban.",
      schema: { example: { ...jailExample, name: "manager", bantime: -1 } },
    }),
    failures("ban-ip")
  );

export const UnbanIpDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "Lift the ban of an address in one jail" }),
    ApiParam({ name: "jail", description: "The jail name, as GET /fail2ban/jails lists it" }),
    ipBody,
    ApiResponse({ status: 200, description: "The jail after the change.", schema: { example: jailExample } }),
    failures("unban-ip"),
    ApiResponse({
      status: 404,
      description: "No such jail",
      schema: { example: { statusCode: 404, message: "Unknown jail", error: "Not Found" } },
    })
  );
