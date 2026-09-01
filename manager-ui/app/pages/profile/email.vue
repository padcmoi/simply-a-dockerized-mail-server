<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

definePageMeta({});

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const auth = useAuthStore();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("profile.emailPage.breadcrumb") }]);

const saving = ref(false);
const confirmOpen = ref(false);
const next = ref("");

// The address in force right now, read from the server rather than the session,
// so the page states what it is actually about to replace.
const { data: me, status } = useAsyncData("email-page-me", () => call<MeProfile>("/auth/jwt/me"), { server: false });
const meLoading = computed(() => status.value !== "success" && status.value !== "error");
const current = computed(() => me.value?.email ?? "");

const schema = z.object({ email: z.email(t("profile.emailInvalid")).max(255) });
const parsed = computed(() => schema.safeParse({ email: next.value.trim() }));
const unchanged = computed(() => next.value.trim().toLowerCase() === current.value.toLowerCase());
const invalid = computed(() => next.value.length > 0 && !parsed.value.success);
const canSubmit = computed(() => parsed.value.success && !unchanged.value && !saving.value && !meLoading.value);

// The confirmation is the point of this page: the address is the login identity
// and the only way back into the account, so changing it is deliberately not a
// single click on the profile form.
function askConfirmation() {
  if (canSubmit.value) confirmOpen.value = true;
}

async function change() {
  saving.value = true;
  try {
    await auth.updateProfile({ email: next.value.trim() });
    next.value = "";
    await refreshNuxtData("email-page-me");
    toast.add({ title: t("profile.emailPage.changed"), color: "success" });
  } catch (err) {
    toast.add({ title: t("profile.emailPage.failed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="warning"
      variant="subtle"
      icon="i-lucide-mail"
      :title="t('profile.emailPage.alertTitle')"
      :description="t('profile.emailPage.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold flex items-center gap-1.5">
          <UIcon name="i-lucide-mail" class="size-4 text-muted" />
          {{ t("profile.emailPage.cardTitle") }}
        </h2>
      </template>

      <div v-if="meLoading" class="space-y-4">
        <USkeleton v-for="i in 2" :key="i" class="h-9 w-full sm:max-w-sm" />
      </div>

      <form v-else class="space-y-4" @submit.prevent="askConfirmation">
        <UFormField :label="t('profile.emailPage.current')">
          <UInput :model-value="current" icon="i-lucide-mail" class="w-full sm:max-w-sm" disabled />
        </UFormField>

        <UFormField
          :label="t('profile.emailPage.next')"
          :hint="t('profile.emailPage.nextHint')"
          :error="invalid ? t('profile.emailInvalid') : unchanged && next.length > 0 ? t('profile.emailPage.same') : undefined"
          required
        >
          <UInput
            v-model="next"
            type="email"
            autocomplete="off"
            placeholder="jane@example.com"
            icon="i-lucide-mail"
            class="w-full sm:max-w-sm"
            required
          />
        </UFormField>
      </form>

      <template #footer>
        <div class="flex justify-end">
          <UButton icon="i-lucide-mail" color="warning" :disabled="!canSubmit" :loading="saving" @click="askConfirmation">
            {{ t("profile.emailPage.submit") }}
          </UButton>
        </div>
      </template>
    </UCard>

    <ConfirmModal
      v-model:open="confirmOpen"
      type="warning"
      :title="t('profile.emailPage.confirmTitle')"
      :description="t('profile.emailPage.confirmHint', { current, next: next.trim() })"
      @confirm="change"
    />
  </div>
</template>
