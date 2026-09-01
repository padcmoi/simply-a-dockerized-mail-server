<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });

const route = useRoute();

const loading = ref(false);
// Read synchronously, before the first render: coming back from a provider the
// page must never flash the login form, since a sign-in is already under way.
// Only a refusal, or a failed exchange, puts the form back.
const resuming = ref(typeof route.query.provider_code === "string");
const state = reactive({ email: "", password: "" });

const { t } = useI18n();
const auth = useAuthStore();
const toast = useToast();
const { resolve: resolveLastRoute } = useLastRoute();
const { persist: persistLocale } = useLocalePreference();
const { providers: passportProviders, pending: passportPending, startUrl } = usePassportProviders();

const schema = z.object({
  email: z.email(t("login.emailInvalid")),
  password: z.string().min(1, t("common.required")),
});

async function signedIn() {
  // Record the interface language in use right after login, so the account
  // profile carries its selected language from the first session.
  await persistLocale();
  // Back to wherever the user was before the session dropped (or they logged
  // out); dashboard only if there is no remembered route.
  await navigateTo(resolveLastRoute());
}

async function onSubmit() {
  loading.value = true;
  try {
    await auth.login(state.email, state.password);
    await signedIn();
  } catch (err) {
    toast.add({
      title: t("login.failed"),
      description: (err as Error).message,
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

// A provider sends the browser back here, not to an API route it could not
// render: the callback redirects to /login carrying either a one-time code to
// trade for a session, or a flat refusal. The query is cleared either way, so a
// reload never replays a code that is already spent.
async function resumeProviderSignIn() {
  const code = typeof route.query.provider_code === "string" ? route.query.provider_code : null;
  const refused = typeof route.query.provider_error === "string";
  if (!code && !refused) return;
  await navigateTo({ path: "/login", query: {} }, { replace: true });
  if (!code) {
    resuming.value = false;
    toast.add({ title: t("login.providerRefused"), color: "error" });
    return;
  }
  loading.value = true;
  try {
    await auth.loginWithPassportProvider(code);
    await signedIn();
  } catch (err) {
    // The code was spent, expired or refused: the form is the way forward again.
    resuming.value = false;
    toast.add({ title: t("login.failed"), description: (err as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

onMounted(resumeProviderSignIn);
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-mail" class="text-primary text-2xl" />
        <h1 class="text-lg font-semibold">{{ t("login.title") }}</h1>
      </div>
      <p class="text-sm text-muted mt-1">{{ t("login.subtitle") }}</p>
    </template>
    <div v-if="resuming" class="flex flex-col items-center gap-3 py-10">
      <UIcon name="i-lucide-loader-2" class="size-8 text-primary animate-spin" />
      <p class="text-sm text-muted">{{ t("login.signingIn") }}</p>
    </div>

    <template v-else>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('login.email')" name="email" required>
          <UInput v-model="state.email" type="email" autocomplete="email" icon="i-lucide-mail" class="w-full" />
        </UFormField>
        <UFormField :label="t('login.password')" name="password" required>
          <UInput v-model="state.password" type="password" autocomplete="current-password" icon="i-lucide-lock" class="w-full" />
        </UFormField>
        <UButton type="submit" :loading="loading" block size="lg">{{ t("login.submit") }}</UButton>
      </UForm>

      <div v-if="passportPending" class="mt-4">
        <USkeleton class="h-11 w-full" />
      </div>
      <div v-else-if="passportProviders.length" class="mt-4 space-y-4">
        <USeparator :label="t('login.or')" />
        <UButton
          v-for="provider in passportProviders"
          :key="provider.id"
          :to="startUrl(provider.id)"
          external
          color="neutral"
          block
          size="lg"
          :disabled="loading"
        >
          <template #leading>
            <GoogleMark v-if="provider.id === 'google'" />
            <UIcon v-else name="i-lucide-key-square" class="size-5" />
          </template>
          {{ t("login.withProvider", { provider: provider.label }) }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
