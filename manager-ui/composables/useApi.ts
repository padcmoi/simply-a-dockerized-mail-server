import { $fetch } from 'ofetch';
import { useAuth } from '~/composables/useAuth';

export function useApi() {
  const { accessToken, logout } = useAuth();
  const config = useRuntimeConfig();

  const api = $fetch.create({
    baseURL: config.public.apiBaseUrl,
    headers: {
      Accept: 'application/json',
    },
    onRequest({ options }) {
      const token = accessToken.value;
      if (token) {
        options.headers = new Headers(options.headers);
        options.headers.set('Authorization', `Bearer ${token}`);
      }
    },
    async onResponseError({ response }) {
      if (response?.status === 401) {
        await logout();
      }
    },
  });

  return { api };
}
