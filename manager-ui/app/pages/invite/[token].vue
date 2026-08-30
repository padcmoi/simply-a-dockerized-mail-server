<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });

const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const auth = useAuthStore();

const loading = ref(true);
const invalid = ref(false);
const info = ref<InviteInfo | null>(null);
const submitting = ref(false);
const done = ref(false);
// Whether the typed email already has an account: null while unknown (empty,
// invalid or still being checked), then the form shows the matching path.
const emailExists = ref<boolean | null>(null);
const checking = ref(false);
const form = reactive({ email: "", displayName: "", password: "" });
let checkTimer: ReturnType<typeof setTimeout> | null = null;

const token = computed(() => route.params.token as string);
const openToken = computed(() => info.value !== null && info.value.email === null);
const emailValid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()));
const schema = computed(() =>
  z.object({
    email: openToken.value ? z.email(t("invite.emailInvalid")) : z.string().optional(),
    displayName: z.string().max(255).optional(),
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
        displayName: form.displayName || undefined,
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

// Existing email: sign in with it, then take the staged grant for that account.
async function claim() {
  submitting.value = true;
  try {
    await auth.login(form.email.trim().toLowerCase(), form.password);
    await $fetch(`/api/v1/accounts/invite/${token.value}/claim`, { method: "POST", headers: auth.authHeaders() });
    toast.add({ title: t("invite.claimed"), color: "success" });
    await navigateTo("/my-space");
  } catch (e) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? t("invite.claimFailed");
    toast.add({ title: msg, color: "error" });
  } finally {
    submitting.value = false;
  }
}

onMounted(loadInvitation);
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

    <div v-if="loading" class="py-8 flex justify-center">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      <span class="sr-only">{{ t("invite.loading") }}</span>
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

    <UForm v-else :schema="schema" :state="form" class="space-y-4" @submit="emailExists === true ? claim() : submit()">
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

      <UFormField v-if="emailExists !== true" :label="t('invite.nameLabel')" :hint="t('invite.nameHint')" name="displayName">
        <UInput v-model="form.displayName" icon="i-lucide-user" autocomplete="name" placeholder="Jane Doe" class="w-full" />
      </UFormField>

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
  </UCard>
</template>
