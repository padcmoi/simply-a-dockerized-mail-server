import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const LoginRiskApi = () => applyDecorators(ApiTags("config"));

const example = { loginRadiusKm: 100, loginChallengeOrder: "question,email" };

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
        "Every session that opens moves the account's usual place to where it opened, and a sign-in further from " +
        "it than this radius is asked for one thing more than the password. The distance is measured locally " +
        "against the dataset the access trails already use, and widened by the accuracy that dataset admits to, " +
        "so a provider answering the middle of the country never turns a move across town into a challenge. Read " +
        "on every sign-in: a change applies to the next one. `loginChallengeOrder` says which of the two proofs is " +
        "offered first, the other standing in when the first cannot be offered at all: no mail configured, or no " +
        "question chosen yet. The authenticator app is in neither order: an account that carries one is asked for " +
        "its code and nothing else, however far away it signed in from.",
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
      description: "Not a whole number of kilometres between 0 and 20037, or an order that is not one of the two",
      schema: { example: { statusCode: 400, message: "Validation failed", error: "Bad Request" } },
    }),
    RootOnly()
  );
