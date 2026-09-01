<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });

const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const auth = useAuthStore();
const { providers: passportProviders, pending: passportPending, startUrl } = usePassportProviders();

const loading = ref(true);
const invalid = ref(false);
const info = ref<InviteInfo | null>(null);
const submitting = ref(false);
const done = ref(false);
// Read synchronously, before the first render: coming back from a provider the
// page must never flash its form, since a sign-in is already under way.
const resuming = ref(typeof route.query.provider_code === "string");
// Whether the typed email already has an account: null while unknown (empty,
// invalid or still being checked), then the form shows the matching path.
const emailExists = ref<boolean | null>(null);
const checking = ref(false);
const form = reactive({ email: "", firstName: "", lastName: "", password: "" });
let checkTimer: ReturnType<typeof setTimeout> | null = null;

const token = computed(() => route.params.token as string);
const openToken = computed(() => info.value !== null && info.value.email === null);
const emailValid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()));
const schema = computed(() =>
  z.object({
    email: openToken.value ? z.email(t("invite.emailInvalid")) : z.string().optional(),
    firstName: z.string().max(255).optional(),
    lastName: z.string().max(255).optional(),
    password: z.string().min(8, t("invite.passwordMin")),
  })
);

watch(
  () => form.email,
  () => {
    emailExists.value = null;
    if (checkTimer) clearTimeout(checkTimer);
    if (!openToken.value || !emailValid.value) return;
    checking.value = true;
    checkTimer = setTimeout(checkEmail, 400);
  }
);

async function checkEmail() {
  const email = form.email.trim().toLowerCase();
  try {
    const res = await $fetch<{ exists: boolean }>(`/api/v1/accounts/invite/${token.value}/email-exists`, {
      query: { email },
    });
    if (email === form.email.trim().toLowerCase()) emailExists.value = res.exists;
  } catch {
    emailExists.value = null;
  } finally {
    checking.value = false;
  }
}

async function loadInvitation() {
  try {
    info.value = await $fetch<InviteInfo>(`/api/v1/accounts/invite/${token.value}`);
  } catch {
    invalid.value = true;
  } finally {
    loading.value = false;
  }
}

// Unknown email: create the account, the staged grant lands on it.
async function submit() {
  submitting.value = true;
  try {
    await $fetch(`/api/v1/accounts/invite/${token.value}/accept`, {
      method: "POST",
      body: {
        email: openToken.value ? form.email.trim().toLowerCase() : undefined,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        password: form.password,
      },
    });
    done.value = true;
  } catch (e) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? t("invite.toast.failed");
    toast.add({ title: msg, color: "error" });
  } finally {
    submitting.value = false;
  }
}

// The account is signed in, whichever door it came through: the staged grant
// moves onto it, and the link is spent.
async function takeGrant() {
  await $fetch(`/api/v1/accounts/invite/${token.value}/claim`, { method: "POST", headers: auth.authHeaders() });
  toast.add({ title: t("invite.claimed"), color: "success" });
  await navigateTo("/my-space");
}

function claimFailed(e: unknown) {
  const msg = (e as { data?: { message?: string } })?.data?.message ?? t("invite.claimFailed");
  toast.add({ title: msg, color: "error" });
}

// Existing email: sign in with it, then take the staged grant for that account.
async function claim() {
  submitting.value = true;
  try {
    await auth.login(form.email.trim().toLowerCase(), form.password);
    await takeGrant();
  } catch (e) {
    claimFailed(e);
  } finally {
    submitting.value = false;
  }
}

// An external provider sends the browser back here rather than to /login, since
// this is where the sign-in started and where it has something left to do: the
// one-time code becomes a session, and that session takes the grant. The query
// is cleared either way, so a reload never replays a code that is already spent.
async function resumeProviderSignIn() {
  const code = typeof route.query.provider_code === "string" ? route.query.provider_code : null;
  const refused = typeof route.query.provider_error === "string";
  if (!code && !refused) return;
  await navigateTo({ path: `/invite/${token.value}`, query: {} }, { replace: true });
  if (!code) {
    resuming.value = false;
    toast.add({ title: t("login.providerRefused"), color: "error" });
    return;
  }
  try {
    await auth.loginWithPassportProvider(code);
    await takeGrant();
  } catch (e) {
    // The code was spent, expired or refused: the form is the way forward again.
    resuming.value = false;
    claimFailed(e);
  }
}

onMounted(async () => {
  await loadInvitation();
  await resumeProviderSignIn();
});
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="rounded-lg p-2 bg-primary/10">
          <UIcon name="i-lucide-mail" class="text-primary text-xl" />
        </div>
        <div>
          <h1 class="font-semibold text-lg">{{ t("app.name") }}</h1>
          <p class="text-xs text-muted">{{ t("invite.subtitle") }}</p>
        </div>
      </div>
    </template>

    <div v-if="loading || resuming" class="py-8 flex flex-col items-center gap-3">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      <p v-if="resuming" class="text-sm text-muted">{{ t("login.signingIn") }}</p>
      <span v-else class="sr-only">{{ t("invite.loading") }}</span>
    </div>

    <div v-else-if="invalid" class="py-8 text-center space-y-3">
      <UIcon name="i-lucide-alert-triangle" class="text-3xl text-error mx-auto" />
      <p class="text-muted">{{ t("invite.invalid") }}</p>
      <UButton to="/login" variant="ghost" size="sm">{{ t("invite.goToLogin") }}</UButton>
    </div>

    <div v-else-if="done" class="py-8 text-center space-y-4">
      <div class="rounded-full w-16 h-16 bg-success/10 flex items-center justify-center mx-auto">
        <UIcon name="i-lucide-check" class="text-3xl text-success" />
      </div>
      <div>
        <p class="font-semibold text-lg">{{ t("invite.success") }}</p>
        <p class="text-muted text-sm mt-1">{{ t("invite.successHint") }}</p>
      </div>
      <UButton to="/login" color="primary" icon="i-lucide-log-in">
        {{ t("invite.goToLogin") }}
      </UButton>
    </div>

    <template v-else>
      <UForm :schema="schema" :state="form" class="space-y-4" @submit="emailExists === true ? claim() : submit()">
        <div v-if="!openToken" class="rounded-lg bg-elevated p-3 space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-at-sign" class="text-muted shrink-0" />
            <span class="text-muted">{{ t("invite.emailLabel") }}:</span>
            <span class="font-medium truncate">{{ info?.email }}</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-users" class="text-muted shrink-0" />
            <span class="text-muted">{{ t("invite.groupLabel") }}:</span>
            <span v-if="info?.groups.length" class="font-medium">{{ info.groups.join(", ") }}</span>
            <span v-else class="italic text-muted">{{ t("invite.noGroup") }}</span>
          </div>
        </div>

        <UFormField v-if="openToken" :label="t('invite.emailLabel')" :hint="t('invite.emailChooseHint')" name="email" required>
          <UInput
            v-model="form.email"
            icon="i-lucide-at-sign"
            autocomplete="email"
            :loading="checking"
            :placeholder="t('invite.emailPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="emailExists === true"
          color="info"
          variant="subtle"
          icon="i-lucide-user-check"
          :title="t('invite.existingTitle')"
          :description="t('invite.existingHint')"
        />

        <div v-if="emailExists !== true" class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <UFormField :label="t('invite.lastNameLabel')" :hint="t('invite.nameHint')" name="lastName">
            <UInput v-model="form.lastName" icon="i-lucide-user" autocomplete="family-name" placeholder="Doe" class="w-full" />
          </UFormField>

          <UFormField :label="t('invite.firstNameLabel')" name="firstName">
            <UInput v-model="form.firstName" icon="i-lucide-user" autocomplete="given-name" placeholder="Jane" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('invite.passwordLabel')" name="password" required>
          <UInput
            v-model="form.password"
            type="password"
            icon="i-lucide-lock"
            :autocomplete="emailExists === true ? 'current-password' : 'new-password'"
            class="w-full"
          />
        </UFormField>

        <UButton
          type="submit"
          color="primary"
          block
          :loading="submitting"
          :icon="emailExists === true ? 'i-lucide-log-in' : 'i-lucide-user-plus'"
        >
          {{ emailExists === true ? t("invite.claimSubmit") : t("invite.submit") }}
        </UButton>
      </UForm>

      <div v-if="openToken && passportPending" class="mt-4">
        <USkeleton class="h-11 w-full" />
      </div>
      <div v-else-if="openToken && passportProviders.length" class="mt-4 space-y-4">
        <USeparator :label="t('login.or')" />
        <UButton
          v-for="provider in passportProviders"
          :key="provider.id"
          :to="startUrl(provider.id, `/invite/${token}`)"
          external
          color="neutral"
          block
          size="lg"
          :disabled="submitting"
        >
          <template #leading>
            <GoogleMark v-if="provider.id === 'google'" />
            <UIcon v-else name="i-lucide-key-square" class="size-5" />
          </template>
          {{ t("invite.claimWithProvider", { provider: provider.label }) }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
