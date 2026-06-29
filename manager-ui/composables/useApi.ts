import type { NitroFetchOptions } from "nitropack";
import { useAuthStore } from "~/stores/auth";

export function useApi() {
  const auth = useAuthStore();
  function call<T>(path: string, opts: NitroFetchOptions<string> = {}) {
    return $fetch<T>(`/api/v1${path}`, {
      ...opts,
      headers: { ...(opts.headers ?? {}), ...auth.authHeaders() },
    });
  }
  return { call };
}
