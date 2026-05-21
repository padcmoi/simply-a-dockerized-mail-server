import { computed } from 'vue';
import { useState } from '#app';

interface Principal {
  sub: string;
  email: string;
  role: 'root' | 'admin' | 'owner' | 'user';
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  principal: Principal | null;
}

/**
 * Holds tokens client-side. For the local (root/webadmin) login path the user types
 * email + password against POST /api/v1/auth/login. For Auth0 SSO, redirect via
 * `@auth0/auth0-vue` - it puts the access_token in its store, we mirror it here.
 */
export function useAuth() {
  const state = useState<AuthState>('auth', () => {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem('mail-manager-auth');
        if (raw) return JSON.parse(raw) as AuthState;
      } catch {
        // ignore
      }
    }
    return { accessToken: null, refreshToken: null, principal: null };
  });

  function persist() {
    if (import.meta.client) {
      localStorage.setItem('mail-manager-auth', JSON.stringify(state.value));
    }
  }

  function setSession(tokens: {
    access_token: string;
    refresh_token?: string;
    principal: Principal;
  }) {
    state.value = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? state.value.refreshToken,
      principal: tokens.principal,
    };
    persist();
  }

  function logout() {
    state.value = { accessToken: null, refreshToken: null, principal: null };
    persist();
    return navigateTo('/login');
  }

  return {
    accessToken: computed(() => state.value.accessToken),
    refreshToken: computed(() => state.value.refreshToken),
    principal: computed(() => state.value.principal),
    isAuthenticated: computed(() => !!state.value.accessToken),
    setSession,
    logout,
  };
}
