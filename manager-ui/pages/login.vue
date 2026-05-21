<script setup lang="ts">
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import { useAuth } from '~/composables/useAuth';

definePageMeta({ layout: 'default' });

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref<string | null>(null);

const { api } = useApi();
const { setSession } = useAuth();
const router = useRouter();

async function loginLocal() {
  loading.value = true;
  errorMsg.value = null;
  try {
    const res = await api<{
      access_token: string;
      refresh_token: string;
      principal: { sub: string; email: string; role: 'root' | 'admin' | 'owner' | 'user' };
    }>('/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    });
    setSession({
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      principal: res.principal,
    });
    router.push('/');
  } catch (err) {
    errorMsg.value = (err as { data?: { message?: string } })?.data?.message ?? 'Login failed';
  } finally {
    loading.value = false;
  }
}

function loginAuth0() {
  // Hook up `@auth0/auth0-vue` here once the tenant + client id are configured in runtimeConfig.
  // const auth0 = useAuth0(); auth0.loginWithRedirect();
  alert('Auth0 SSO not yet wired - fill NUXT_PUBLIC_AUTH0_* env first.');
}
</script>

<template>
  <div class="min-h-screen grid place-items-center bg-slate-100">
    <div class="w-full max-w-sm bg-white rounded-lg shadow p-8">
      <h1 class="text-xl font-semibold mb-6">Mail manager - sign in</h1>
      <form class="space-y-4" @submit.prevent="loginLocal">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary-600 hover:bg-primary-700 text-white rounded py-2 text-sm font-medium disabled:opacity-60"
        >
          {{ loading ? 'Signing in...' : 'Sign in' }}
        </button>
        <p v-if="errorMsg" class="text-red-600 text-sm text-center">{{ errorMsg }}</p>
      </form>
      <div class="my-6 flex items-center gap-2 text-xs text-slate-400">
        <span class="flex-1 border-t border-slate-200" />
        <span>or</span>
        <span class="flex-1 border-t border-slate-200" />
      </div>
      <button
        type="button"
        class="w-full border border-slate-300 hover:bg-slate-50 rounded py-2 text-sm font-medium"
        @click="loginAuth0"
      >
        Continue with Auth0 SSO
      </button>
    </div>
  </div>
</template>
