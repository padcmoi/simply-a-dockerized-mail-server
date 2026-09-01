<script setup lang="ts">
definePageMeta({});

// Mirrors changeMyPasswordSchema's `newPassword: z.string().min(8)`. The API
// stays the authority; this only spares a round-trip and names the rule here.
const PASSWORD_MIN = 8;

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage, apiErrorBody } = useApiError();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("profile.passwordPage.breadcrumb") }]);

const saving = ref(false);
// The API's refusal of the current password, pinned on its own field; typing
// there again drops it, since it judged what was submitted, not what is typed.
const currentError = ref<string | null>(null);
const form = reactive({ current: "", next: "", confirm: "" });

// Whether the account holds a password at all: one created by an external
// sign-in has none, so there is no current password to ask for and this page
// sets the first one instead.
const { data: me, status } = useAsyncData("password-page-me", () => call<MeProfile>("/auth/jwt/me"), { server: false });
const meLoading = computed(() => status.value !== "success" && status.value !== "error");
const hasPassword = computed(() => me.value?.hasPassword !== false);

const tooShort = computed(() => form.next.length > 0 && form.next.length < PASSWORD_MIN);
const mismatch = computed(() => form.confirm.length > 0 && form.confirm !== form.next);
const canSubmit = computed(
  () =>
    (!hasPassword.value || form.current.length > 0) &&
    form.next.length >= PASSWORD_MIN &&
    form.confirm === form.next &&
    !saving.value
);

watch(
  () => form.current,
  () => (currentError.value = null)
);

async function submit() {
  if (!canSubmit.value) return;
  saving.value = true;
  try {
    await call("/auth/jwt/me/password", {
      method: "PATCH",
      body: hasPassword.value ? { currentPassword: form.current, newPassword: form.next } : { newPassword: form.next },
    });
    form.current = "";
    form.next = "";
    form.confirm = "";
    toast.add({ title: t("profile.passwordPage.changed"), color: "success" });
    await refreshNuxtData("password-page-me");
  } catch (err) {
    if (apiErrorBody(err)?.code === "auth.wrongPassword") {
      currentError.value = apiErrorMessage(err);
    } else {
      toast.add({ title: t("profile.passwordPage.failed"), description: apiErrorMessage(err), color: "error" });
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-key-round"
      :title="hasPassword ? t('profile.passwordPage.alertTitle') : t('profile.passwordPage.createTitle')"
      :description="hasPassword ? t('profile.passwordPage.alertDescription') : t('profile.passwordPage.createDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold flex items-center gap-1.5">
          <UIcon name="i-lucide-key-round" class="size-4 text-muted" />
          {{ hasPassword ? t("profile.passwordPage.alertTitle") : t("profile.passwordPage.createTitle") }}
        </h2>
      </template>

      <div v-if="meLoading" class="space-y-4">
        <USkeleton v-for="i in 3" :key="i" class="h-9 w-full sm:max-w-sm" />
      </div>

      <form v-else class="space-y-4" @submit.prevent="submit">
        <UFormField v-if="hasPassword" :label="t('profile.passwordPage.current')" :error="currentError ?? undefined" required>
          <UInput v-model="form.current" type="password" autocomplete="current-password" class="w-full sm:max-w-sm" required />
        </UFormField>

        <UFormField
          :label="t('profile.passwordPage.new')"
          :hint="t('profile.passwordPage.min', { value: PASSWORD_MIN })"
          :error="tooShort ? t('profile.passwordPage.min', { value: PASSWORD_MIN }) : undefined"
          required
        >
          <PasswordInput v-model="form.next" autocomplete="new-password" class="w-full sm:max-w-sm" required />
        </UFormField>

        <UFormField
          :label="t('profile.passwordPage.confirm')"
          :error="mismatch ? t('profile.passwordPage.mismatch') : undefined"
          required
        >
          <PasswordInput v-model="form.confirm" autocomplete="new-password" class="w-full sm:max-w-sm" required />
        </UFormField>
      </form>

      <template #footer>
        <div class="flex justify-end">
          <UButton icon="i-lucide-key-round" :disabled="!canSubmit || meLoading" :loading="saving" @click="submit">
            {{ hasPassword ? t("profile.passwordPage.submit") : t("profile.passwordPage.createSubmit") }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
