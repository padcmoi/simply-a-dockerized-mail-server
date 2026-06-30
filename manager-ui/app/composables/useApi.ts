import type { NitroFetchOptions } from "nitropack";
import { useAuthStore } from "~/stores/auth";

interface FetchError {
  statusCode?: number;
  response?: { status?: number };
}

export function useApi() {
  const auth = useAuthStore();
  async function call<T>(path: string, opts: NitroFetchOptions<string> = {}) {
    const url = `/api/v1${path}`;
    try {
      return await $fetch<T>(url, {
        ...opts,
        headers: { ...(opts.headers ?? {}), ...auth.authHeaders() },
      });
    } catch (raw) {
      const err = raw as FetchError;
      const status = err.statusCode ?? err.response?.status;
      if (status !== 401 || !auth.session) throw raw;
      const ok = await auth.refresh();
      if (!ok) {
        await navigateTo("/login");
        throw raw;
      }
      return await $fetch<T>(url, {
        ...opts,
        headers: { ...(opts.headers ?? {}), ...auth.authHeaders() },
      });
    }
  }
  return { call };
}
