import { HttpException, HttpStatus } from "@nestjs/common";

// Every message an exception could carry would be written in one language, and
// manager-ui runs in two. So the wire carries a stable `code` plus the values
// its sentence needs, and the UI resolves both through i18n (`apiErrors.*` in
// i18n/locales). `message` still holds the English sentence: it is what a
// direct API client sees (curl, the OpenAPI examples), and what manager-ui
// falls back to when it meets a code it does not know yet.
//
// Codes are enumerated rather than free strings so a rename here breaks the
// compile instead of silently degrading the UI to its fallback.
export const API_ERROR_CODES = [
  "validation.failed",
  "recipients.postmasterReserved",
  "recipients.alreadyExists",
  "recipients.notFound",
  "recipients.alreadyAssigned",
  "recipients.postmasterUnassignable",
  "recipients.postmasterImmutable",
  "recipients.postmasterUndeletable",
  "recipients.quotaBelowUsage",
  "recipients.quotaExceedsDomain",
  "aliases.notFound",
  "aliases.alreadyAssigned",
  "aliases.postmasterUnassignable",
  "aliases.alreadyExists",
  "mail.notConfigured",
  "mail.otpInvalid",
  "mail.sendFailed",
  "delegations.quotaExceedsDomain",
  "delegations.ownerNotDelegable",
  "delegations.noDelegation",
  "delegations.recipientCapReached",
  "delegations.aliasCapReached",
  "delegations.reserveExceeded",
  "deliverability.probeUnavailable",
  "auth.wrongPassword",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

// Interpolation values for the i18n message behind the code. Numbers stay
// numbers: the unit and the formatting belong to the locale, not here.
export type ApiErrorParams = Record<string, string | number>;

export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: ApiErrorCode, message: string, params: ApiErrorParams = {}) {
    super({ statusCode: status, code, params, message }, status);
  }
}
