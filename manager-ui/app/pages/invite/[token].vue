<script setup lang="ts">
import { z } from "zod";

definePageMeta({ layout: "auth" });

interface InviteInfo {
  email: string;
  groups: string[];
  expiresAt: string;
}

const route = useRoute();
const { t } = useI18n();
const toast = useToast();

const loading = ref(true);
const invalid = ref(false);
const info = ref<InviteInfo | null>(null);
const submitting = ref(false);
const done = ref(false);
const form = reactive({ displayName: "", password: "" });

const token = computed(() => route.params.token as string);
const schema = z.object({
  displayName: z.string().max(255).optional(),
  password: z.string().min(8, t("invite.passwordMin")),
});

async function loadInvitation() {
  try {
    info.value = await $fetch<InviteInfo>(`/api/v1/accounts/invite/${token.value}`);
  } catch {
    invalid.value = true;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  submitting.value = true;
  try {
    await $fetch(`/api/v1/accounts/invite/${token.value}/accept`, {
      method: "POST",
      body: { displayName: form.displayName || undefined, password: form.password },
    });
    done.value = true;
  } catch (e) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? t("invite.toast.failed");
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

    <UForm v-else :schema="schema" :state="form" class="space-y-4" @submit="submit">
      <div class="rounded-lg bg-elevated p-3 space-y-2 text-sm">
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

      <UFormField :label="t('invite.nameLabel')" :hint="t('invite.nameHint')" name="displayName">
        <UInput v-model="form.displayName" icon="i-lucide-user" autocomplete="name" placeholder="Jane Doe" class="w-full" />
      </UFormField>

      <UFormField :label="t('invite.passwordLabel')" name="password" required>
        <UInput v-model="form.password" type="password" icon="i-lucide-lock" autocomplete="new-password" class="w-full" />
      </UFormField>

      <UButton type="submit" color="primary" block :loading="submitting" icon="i-lucide-user-plus">
        {{ t("invite.submit") }}
      </UButton>
    </UForm>
  </UCard>
</template>
