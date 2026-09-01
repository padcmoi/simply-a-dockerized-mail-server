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

const tooShort = computed(() => form.next.length > 0 && form.next.length < PASSWORD_MIN);
const mismatch = computed(() => form.confirm.length > 0 && form.confirm !== form.next);
const canSubmit = computed(
  () => form.current.length > 0 && form.next.length >= PASSWORD_MIN && form.confirm === form.next && !saving.value
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
      body: { currentPassword: form.current, newPassword: form.next },
    });
    form.current = "";
    form.next = "";
    form.confirm = "";
    toast.add({ title: t("profile.passwordPage.changed"), color: "success" });
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
      :title="t('profile.passwordPage.alertTitle')"
      :description="t('profile.passwordPage.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold flex items-center gap-1.5">
          <UIcon name="i-lucide-key-round" class="size-4 text-muted" />
          {{ t("profile.passwordPage.alertTitle") }}
        </h2>
      </template>

      <form class="space-y-4" @submit.prevent="submit">
        <UFormField :label="t('profile.passwordPage.current')" :error="currentError ?? undefined" required>
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
          <UButton icon="i-lucide-key-round" :disabled="!canSubmit" :loading="saving" @click="submit">
            {{ t("profile.passwordPage.submit") }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
