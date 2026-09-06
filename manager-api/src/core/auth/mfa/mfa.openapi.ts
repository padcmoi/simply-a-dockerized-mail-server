import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

export const MfaApi = () => applyDecorators(ApiTags("auth-mfa"));

const challengeExample = {
  mfaRequired: true,
  method: "email",
  challenge: "9m2Kx7...",
  expiresAt: "2026-09-05T18:10:00.000Z",
  hint: "j***@example.com",
};

const questionExample = {
  mfaRequired: true,
  method: "question",
  challenge: "9m2Kx7...",
  expiresAt: "2026-09-05T18:10:00.000Z",
  question: "father",
};

export const MfaLoginDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Finish a sign-in that came from an unusual place",
      description:
        "Public, like the first step: there is no session yet. `answer` is the six-digit code received by mail, " +
        "or the answer to the security question, depending on the `method` the first step announced. Answers with " +
        "the same token pair a plain sign-in would have. The place the sign-in came from becomes the account's new " +
        "reference point, so the next sign-in from there is not challenged again.",
    }),
    ApiBody({ schema: { example: { challenge: "9m2Kx7...", answer: "123456" } } }),
    ApiResponse({ status: 200, description: "Token pair" }),
    ApiResponse({ status: 400, description: "mfa.invalidCode / mfa.invalidAnswer" }),
    ApiResponse({ status: 401, description: "mfa.challengeExpired" }),
    ApiResponse({ status: 429, description: "mfa.tooManyAttempts" })
  );

export const MfaResendDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Send a fresh code for a challenge answered by mail",
      description:
        "Public. The previous code stops working. Refused with 429 until the interval every other mail obeys " +
        "(`mail_min_interval_ms`) has passed since the last send.",
    }),
    ApiBody({ schema: { example: { challenge: "9m2Kx7..." } } }),
    ApiResponse({ status: 200, schema: { example: { sent: true, hint: "j***@example.com" } } }),
    ApiResponse({ status: 401, description: "mfa.challengeExpired" }),
    ApiResponse({ status: 429, description: "mfa.resendTooSoon" })
  );

export const MfaMethodDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Prove the same sign-in the other way",
      description:
        "Public. Swaps a live challenge between the code by mail and the security question, keeping its " +
        "identifier, its deadline and the tries already spent: switching changes the proof, it never buys a fresh " +
        "set of guesses. `email` is refused with 409 on a server that cannot send mail, `question` on an account " +
        "that has never chosen one, which is why the challenge announces the other way in `alternative` and the " +
        "interface only offers what is there. Switching to the mail obeys the interval every other mail obeys, " +
        "unless no code has gone out on this challenge yet.",
    }),
    ApiBody({ schema: { example: { challenge: "9m2Kx7...", method: "email" } } }),
    ApiResponse({ status: 200, schema: { example: challengeExample } }),
    ApiResponse({ status: 401, description: "mfa.challengeExpired" }),
    ApiResponse({ status: 409, description: "mfa.methodUnavailable" }),
    ApiResponse({ status: 429, description: "mfa.resendTooSoon" })
  );

export const SecurityQuestionStatusDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "The caller's security question, if one is set",
      description:
        "Session-scoped, JWT only. The answer is never returned, in any form. This question is what a sign-in from " +
        "an unusual place falls back to when the account has no authenticator app and the server cannot send mail.",
    }),
    ApiResponse({
      status: 200,
      schema: { example: { set: true, question: "father", catalogue: ["father", "mother", "school"] } },
    })
  );

export const SetSecurityQuestionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Set or replace the caller's security question",
      description:
        "Session-scoped, JWT only. `question` is one of the keys `catalogue` lists, never a sentence: the wording " +
        "belongs to whoever displays it, in their own language. The answer is normalised (case, accents and " +
        "spacing) and stored as a keyed hash. It is chosen once: a second call is refused with 409, and nothing " +
        "in the API undoes it.",
    }),
    ApiBody({ schema: { example: { question: "father", answer: "joel" } } }),
    ApiResponse({ status: 200, schema: { example: { set: true, question: "father", catalogue: ["father", "mother"] } } }),
    ApiResponse({ status: 400, description: "validation.failed: the question is not one the API offers" }),
    ApiResponse({ status: 409, description: "securityQuestion.alreadySet: chosen once, never replaced" })
  );

export const AdminResetSecurityQuestionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Clear an account's security question",
      description:
        "The one way back for an account whose owner no longer remembers their own answer: the question and its " +
        "answer go, the account's usual sign-in place stays, and the next sign-in asks for a new question before " +
        "anything else. Every live session of that account is revoked at the same time (`revoked` counts them), so " +
        "it signs in again rather than carrying on behind a question that no longer exists. Never the account's " +
        "own doing, since a question a session could rewrite would protect nothing. Gated like an edit of the " +
        "account.",
    }),
    ApiResponse({ status: 200, schema: { example: { reset: true, revoked: 2 } } }),
    ApiResponse({ status: 404, description: "Unknown account" })
  );

export { challengeExample, questionExample };
