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
// The other step, for a sign-in that came from further away than this account
// usually signs in from: a code sent by mail, or the security question. It is
// never asked on top of the app's code, so the two steps never overlap.
const mfa = ref<MfaChallenge | null>(null);
const mfaAnswer = ref("");
const resending = ref(false);
const switching = ref(false);
// The six cells answer a refused code themselves: shaken and emptied.
const otp = useTemplateRef<{ reject: () => Promise<void> }>("otp");
const mfaOtp = useTemplateRef<{ reject: () => Promise<void> }>("mfaOtp");
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

// The challenge names the question by key, so it reads in the language of
// whoever is signing in rather than the one it was chosen in.
const questionLabel = computed(() =>
  mfa.value?.question ? t(`profile.securityQuestionPage.questions.${mfa.value.question}`) : t("login.mfaQuestionLabel")
);

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
async function settle(answer: TwoFactorChallenge | MfaChallenge | null) {
  if (answer && "mfaRequired" in answer) {
    mfa.value = answer;
    mfaAnswer.value = "";
    return;
  }
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

async function onMfaVerify() {
  const pending = mfa.value;
  if (!pending || !mfaAnswer.value.trim()) return;
  loading.value = true;
  try {
    await auth.loginMfa(pending.challenge, mfaAnswer.value, state.email);
    await signedIn();
  } catch (err) {
    // An expired or exhausted challenge cannot be answered any more: back to
    // the first step. A wrong answer keeps the step, the challenge survives it.
    if (apiErrorBody(err)?.code === "mfa.challengeExpired") mfa.value = null;
    else if (pending.method === "email") await mfaOtp.value?.reject();
    else mfaAnswer.value = "";
    toast.add({ title: t("login.mfaFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    loading.value = false;
  }
}

async function onMfaResend() {
  const pending = mfa.value;
  if (!pending) return;
  resending.value = true;
  try {
    const { hint } = await auth.resendMfaCode(pending.challenge);
    mfaAnswer.value = "";
    toast.add({ title: t("login.mfaResent", { hint }), color: "success" });
  } catch (err) {
    if (apiErrorBody(err)?.code === "mfa.challengeExpired") mfa.value = null;
    toast.add({ title: t("login.mfaResendFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    resending.value = false;
  }
}

// The same sign-in, proved the other way: whoever cannot reach their mailbox
// right now answers the question, and whoever no longer knows their answer asks
// for the code. The button only exists where the server said the other way is
// there to be had.
async function onMfaSwitch() {
  const pending = mfa.value;
  if (!pending?.alternative) return;
  switching.value = true;
  try {
    const next = await auth.switchMfaMethod(pending.challenge, pending.alternative);
    mfa.value = { ...next, debug: next.debug ?? pending.debug };
    mfaAnswer.value = "";
  } catch (err) {
    if (apiErrorBody(err)?.code === "mfa.challengeExpired") mfa.value = null;
    toast.add({ title: t("login.mfaSwitchFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    switching.value = false;
  }
}

function backToLogin() {
  challenge.value = null;
  mfa.value = null;
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
    <form v-if="mfa" class="space-y-4" @submit.prevent="onMfaVerify">
      <div class="text-center">
        <p class="font-medium">{{ t("login.mfaTitle") }}</p>
        <p class="text-sm text-muted mt-1">
          {{ mfa.method === "email" ? t("login.mfaMailHint", { hint: mfa.hint ?? "" }) : t("login.mfaQuestionHint") }}
        </p>
        <SecurityMfaDebug v-if="mfa.debug" :debug="mfa.debug" />
      </div>

      <template v-if="mfa.method === 'email'">
        <UFormField :label="t('login.code')" required>
          <div class="flex justify-center">
            <OtpInput ref="mfaOtp" v-model="mfaAnswer" autofocus :disabled="loading" @complete="onMfaVerify" />
          </div>
        </UFormField>
        <UButton color="neutral" variant="link" size="sm" icon="i-lucide-send" :loading="resending" block @click="onMfaResend">
          {{ t("login.mfaResend") }}
        </UButton>
      </template>

      <template v-else>
        <UFormField :label="questionLabel" required>
          <UInput v-model="mfaAnswer" autocomplete="off" maxlength="255" icon="i-lucide-key-round" autofocus class="w-full" />
        </UFormField>
        <UButton type="submit" :loading="loading" :disabled="!mfaAnswer.trim()" block size="lg">
          {{ t("login.verify") }}
        </UButton>
      </template>

      <UButton
        v-if="mfa.alternative"
        color="neutral"
        variant="link"
        size="sm"
        :icon="mfa.alternative === 'email' ? 'i-lucide-mail' : 'i-lucide-key-round'"
        :loading="switching"
        block
        @click="onMfaSwitch"
      >
        {{ mfa.alternative === "email" ? t("login.mfaSwitchToMail") : t("login.mfaSwitchToQuestion") }}
      </UButton>

      <div class="flex justify-end">
        <UButton color="neutral" variant="link" size="sm" icon="i-lucide-arrow-left" @click="backToLogin">
          {{ t("login.backToLogin") }}
        </UButton>
      </div>
    </form>

    <form v-else-if="challenge" class="space-y-4" @submit.prevent="onVerify">
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
