import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const LoginRiskApi = () => applyDecorators(ApiTags("config"));

const example = {
  loginRadiusKm: 100,
  loginChallengeOrder: "question,email",
  loginChallengeExclusive: false,
  geoipCacheDays: 90,
  loginAddressDays: 30,
  loginNetworkDays: 180,
};

const RootOnly = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: "No valid access token" }),
    ApiResponse({ status: 403, description: "Authenticated but not a root account" })
  );

export const GetLoginRiskDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Read how far a sign-in may be before it has to prove itself",
      description:
        "Every session that opens remembers the address it came from, with its coordinates, and the operator " +
        "(autonomous system) behind it. A sign-in from an address the account knows is measured against that " +
        "address's own record; one from an address it does not know is measured against the nearest place it " +
        "knows. Further than this radius, or from an operator the account has never used, it is asked for one " +
        "thing more than the password. An address is known for `loginAddressDays` after its last sign-in, an " +
        "operator for `loginNetworkDays`; past that they are forgotten, and an account that has signed in before " +
        'but whose addresses or operators have all expired is asked for a proof too (`reasons: ["expired"]`). The ' +
        "coordinates and the operator come from an online provider (ipwho.is by default, GEOIP_URL) and every " +
        "answer is cached in the database for `geoipCacheDays`, so an address is looked up once. Read on every " +
        "sign-in: a change applies to the next one. `loginChallengeOrder` says which of the two proofs is " +
        "offered first, the other standing in when the first cannot be offered at all: no mail configured, or no " +
        "question chosen yet. `loginChallengeExclusive` (off by default) makes the first the only one: the other " +
        "never stands in and a live challenge cannot switch to it. The authenticator app is in neither order: an " +
        "account that carries one is asked for its code and nothing else, however far away it signed in from.",
    }),
    ApiResponse({ status: 200, schema: { example } }),
    RootOnly()
  );

export const UpdateLoginRiskDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Change the radius a sign-in may stray within (0 turns the check off)",
      description:
        "Zero stops asking altogether, whatever the distance. The ceiling is half the Earth's circumference, past " +
        "which no two points are far from one another.",
    }),
    ApiBody({ schema: { example } }),
    ApiResponse({ status: 200, schema: { example } }),
    ApiResponse({
      status: 400,
      description:
        "Not a whole number of kilometres between 0 and 20037, an order that is not one of the two, an exclusivity " +
        "that is not a boolean, or a cache, address or operator duration outside 1 to 365 days",
      schema: { example: { statusCode: 400, message: "Validation failed", error: "Bad Request" } },
    }),
    RootOnly()
  );
