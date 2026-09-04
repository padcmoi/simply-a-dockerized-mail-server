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
// The second step, when the account asks for one: the challenge the first step
// answered with, and the code typed against it. Either kind of code goes in
// the same field; the switch only changes what the field says it expects.
const challenge = ref<string | null>(null);
// The six cells answer a refused code themselves: shaken and emptied.
const otp = useTemplateRef<{ reject: () => Promise<void> }>("otp");
const state = reactive({ email: "", password: "" });
const twoFactor = reactive({ code: "", recovery: false });

const { t } = useI18n();
const auth = useAuthStore();
const toast = useToast();
const { apiErrorBody, apiErrorMessage } = useApiError();
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

// A sign-in that came back with a challenge stops here, on the code step; one
// that came back with a session is done.
async function settle(answer: TwoFactorChallenge | null) {
  if (answer) {
    challenge.value = answer.challenge;
    twoFactor.code = "";
    twoFactor.recovery = false;
    return;
  }
  await signedIn();
}

async function onSubmit() {
  loading.value = true;
  try {
    await settle(await auth.login(state.email, state.password));
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
    await settle(await auth.loginWithPassportProvider(code));
    resuming.value = false;
  } catch (err) {
    // The code was spent, expired or refused: the form is the way forward again.
    resuming.value = false;
    toast.add({ title: t("login.failed"), description: (err as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

async function onVerify() {
  if (!challenge.value || twoFactor.code.trim().length < 6) return;
  loading.value = true;
  try {
    await auth.loginTwoFactor(challenge.value, twoFactor.code, state.email);
    await signedIn();
  } catch (err) {
    // An expired or exhausted challenge cannot be answered any more: back to
    // the first step. A wrong code keeps the step, the challenge survives it.
    if (apiErrorBody(err)?.code === "twoFactor.challengeExpired") challenge.value = null;
    else if (twoFactor.recovery) twoFactor.code = "";
    else await otp.value?.reject();
    toast.add({ title: t("login.twoFactorFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    loading.value = false;
  }
}

function backToLogin() {
  challenge.value = null;
  state.password = "";
}

function toggleRecovery() {
  twoFactor.recovery = !twoFactor.recovery;
  twoFactor.code = "";
}

onMounted(resumeProviderSignIn);
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <div class="flex flex-col items-center text-center">
        <img src="~/assets/naskot-mail-logo.svg" alt="" width="72" height="72" class="size-16 mb-3" />
        <h1 class="text-lg font-semibold">{{ t("login.title") }}</h1>
        <p class="text-sm text-muted mt-1">{{ t("login.subtitle") }}</p>
      </div>
    </template>
    <form v-if="challenge" class="space-y-4" @submit.prevent="onVerify">
      <div class="text-center">
        <p class="font-medium">{{ t("login.twoFactorTitle") }}</p>
        <p class="text-sm text-muted mt-1">
          {{ twoFactor.recovery ? t("login.twoFactorRecoveryHint") : t("login.twoFactorHint") }}
        </p>
      </div>
      <template v-if="twoFactor.recovery">
        <UFormField :label="t('login.recoveryCode')" required>
          <UInput
            v-model="twoFactor.code"
            autocomplete="one-time-code"
            maxlength="16"
            placeholder="XXXXX-XXXXX"
            icon="i-lucide-key-round"
            autofocus
            class="w-full"
          />
        </UFormField>
        <UButton type="submit" :loading="loading" :disabled="twoFactor.code.trim().length < 6" block size="lg">
          {{ t("login.verify") }}
        </UButton>
      </template>
      <UFormField v-else :label="t('login.code')" required>
        <div class="flex justify-center">
          <OtpInput ref="otp" v-model="twoFactor.code" autofocus :disabled="loading" @complete="onVerify" />
        </div>
      </UFormField>
      <div class="flex justify-between gap-2">
        <UButton color="neutral" variant="link" size="sm" @click="toggleRecovery">
          {{ twoFactor.recovery ? t("login.useAppCode") : t("login.useRecoveryCode") }}
        </UButton>
        <UButton color="neutral" variant="link" size="sm" icon="i-lucide-arrow-left" @click="backToLogin">
          {{ t("login.backToLogin") }}
        </UButton>
      </div>
    </form>

    <div v-else-if="resuming" class="flex flex-col items-center gap-3 py-10">
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
