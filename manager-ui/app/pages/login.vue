<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });

const loading = ref(false);
const state = reactive({ email: "", password: "" });

const { t } = useI18n();
const auth = useAuthStore();
const toast = useToast();
const { resolve: resolveLastRoute } = useLastRoute();
const { persist: persistLocale } = useLocalePreference();

const schema = z.object({
  email: z.email(t("login.emailInvalid")),
  password: z.string().min(1, t("common.required")),
});

async function onSubmit() {
  loading.value = true;
  try {
    await auth.login(state.email, state.password);
    // Record the interface language in use right after login, so the account
    // profile carries its selected language from the first session.
    await persistLocale();
    // Back to wherever the user was before the session dropped (or they logged
    // out); dashboard only if there is no remembered route.
    await navigateTo(resolveLastRoute());
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
    <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField :label="t('login.email')" name="email" required>
        <UInput v-model="state.email" type="email" autocomplete="email" icon="i-lucide-mail" class="w-full" />
      </UFormField>
      <UFormField :label="t('login.password')" name="password" required>
        <UInput v-model="state.password" type="password" autocomplete="current-password" icon="i-lucide-lock" class="w-full" />
      </UFormField>
      <UButton type="submit" :loading="loading" block size="lg">{{ t("login.submit") }}</UButton>
    </UForm>
  </UCard>
</template>
