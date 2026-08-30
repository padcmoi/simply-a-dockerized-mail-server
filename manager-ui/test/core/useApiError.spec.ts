import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { useApiError } from "~/composables/useApiError";

// The default setup.ts useI18n has te=()=>true; each test that cares about the
// mapping/fallback path re-stubs useI18n so it controls te and t precisely.
function stubI18n(te: (k: string) => boolean, t: (k: string, p?: Record<string, unknown>) => string) {
  vi.stubGlobal("useI18n", () => ({ t, te, locale: ref("en_GB"), locales: ref([]) }));
}

describe("useApiError.apiErrorBody", () => {
  it("returns the ofetch err.data body, undefined when absent", () => {
    stubI18n(
      () => true,
      (k) => k
    );
    const { apiErrorBody } = useApiError();
    expect(apiErrorBody({ data: { code: "X" } })).toEqual({ code: "X" });
    expect(apiErrorBody({})).toBeUndefined();
    expect(apiErrorBody(new Error("boom"))).toBeUndefined();
  });
});

describe("useApiError.apiErrorStatus", () => {
  it("prefers statusCode, falls back to response.status, else undefined", () => {
    stubI18n(
      () => true,
      (k) => k
    );
    const { apiErrorStatus } = useApiError();
    expect(apiErrorStatus({ statusCode: 404 })).toBe(404);
    expect(apiErrorStatus({ response: { status: 503 } })).toBe(503);
    expect(apiErrorStatus({ statusCode: 400, response: { status: 500 } })).toBe(400);
    expect(apiErrorStatus({})).toBeUndefined();
  });
});

describe("useApiError.apiErrorMessage", () => {
  it("translates a known code with its params", () => {
    stubI18n(
      (k) => k === "apiErrors.QUOTA_EXCEEDED",
      (k, p) => `t(${k}|${JSON.stringify(p)})`
    );
    const { apiErrorMessage } = useApiError();
    const msg = apiErrorMessage({ data: { code: "QUOTA_EXCEEDED", params: { max: 5 } } });
    expect(msg).toBe('t(apiErrors.QUOTA_EXCEEDED|{"max":5})');
  });

  it("passes an empty params object when the code carries none", () => {
    stubI18n(
      () => true,
      (k, p) => `${k}|${JSON.stringify(p)}`
    );
    const { apiErrorMessage } = useApiError();
    expect(apiErrorMessage({ data: { code: "NO_PARAMS" } })).toBe("apiErrors.NO_PARAMS|{}");
  });

  it("falls back to the API English message string for an unknown code", () => {
    stubI18n(
      () => false,
      (k) => k
    );
    const { apiErrorMessage } = useApiError();
    expect(apiErrorMessage({ data: { code: "NEVER_SEEN", message: "Something went wrong" } })).toBe("Something went wrong");
  });

  it("joins a Nest validation message array with the code unresolved", () => {
    stubI18n(
      () => false,
      (k) => k
    );
    const { apiErrorMessage } = useApiError();
    expect(apiErrorMessage({ data: { code: "BAD", message: ["a is required", "b is invalid"] } })).toBe(
      "a is required, b is invalid"
    );
  });

  it("joins a bare validation array when there is no code", () => {
    stubI18n(
      () => true,
      (k) => k
    );
    const { apiErrorMessage } = useApiError();
    expect(apiErrorMessage({ data: { message: ["x", "y"] } })).toBe("x, y");
  });

  it("returns a bare message string when there is no code", () => {
    stubI18n(
      () => true,
      (k) => k
    );
    const { apiErrorMessage } = useApiError();
    expect(apiErrorMessage({ data: { message: "plain message" } })).toBe("plain message");
  });

  it("falls back to the thrown Error message when there is no body", () => {
    stubI18n(
      () => true,
      (k) => k
    );
    const { apiErrorMessage } = useApiError();
    expect(apiErrorMessage(new Error("network down"))).toBe("network down");
  });
});
