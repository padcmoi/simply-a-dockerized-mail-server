// What the fetch layer answers with, error shapes included.

export interface FetchError {
  statusCode?: number;
  response?: { status?: number };
}

// Shape of the JSON body manager-api puts on a failed response, which ofetch
// hangs off `err.data`. `code` and `params` come from ApiError (see
// manager-api/src/core/common/api-error.ts); `issues` from ZodValidationPipe.
export interface ApiErrorBody {
  code?: string;
  params?: Record<string, string | number>;
  message?: string | string[];
  issues?: { path: (string | number)[]; message: string }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}
