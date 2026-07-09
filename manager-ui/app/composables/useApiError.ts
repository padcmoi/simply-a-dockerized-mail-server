// Shape of the JSON body manager-api puts on a failed response, which ofetch
// hangs off `err.data`. `code` and `params` come from ApiError (see
// manager-api/src/core/common/api-error.ts); `issues` from ZodValidationPipe.
interface ApiErrorBody {
  code?: string;
  params?: Record<string, string | number>;
  message?: string | string[];
  issues?: { path: (string | number)[]; message: string }[];
}

export function useApiError() {
  const { t, te } = useI18n();

  function apiErrorBody(err: unknown) {
    return (err as { data?: ApiErrorBody }).data;
  }

  function apiErrorStatus(err: unknown) {
    const raw = err as { statusCode?: number; response?: { status?: number } };
    return raw.statusCode ?? raw.response?.status;
  }

  // The API answers a stable `code` plus the values its sentence needs, never
  // a sentence: it has no idea which of the two locales is displayed. The code
  // resolves under `apiErrors.*` and its params are interpolated into the
  // translation.
  //
  // Three fallbacks, in order. An unknown code (a route this UI has not caught
  // up with) falls back to the English `message` the API also sends, which
  // beats showing the raw key. A bare `message` array is Nest's own validation
  // shape. Failing everything, ofetch's "[POST] ...: 400 Bad Request".
  function apiErrorMessage(err: unknown) {
    const body = apiErrorBody(err);
    const key = body?.code ? `apiErrors.${body.code}` : null;
    if (key && te(key)) return t(key, body?.params ?? {});
    if (Array.isArray(body?.message)) return body.message.join(", ");
    return body?.message ?? (err as Error).message;
  }

  return { apiErrorBody, apiErrorStatus, apiErrorMessage };
}
