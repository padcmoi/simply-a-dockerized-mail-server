<script setup lang="ts">
definePageMeta({ layout: "auth" });

interface InviteInfo {
  email: string;
  domains: string[];
  expiresAt: string;
}

const loading = ref(true);
const invalid = ref(false);
const info = ref<InviteInfo | null>(null);

const username = ref("");
const name = ref("");
const password = ref("");
const submitting = ref(false);
const done = ref(false);

const token = computed(() => route.params.token as string);
const route = useRoute();
const { t } = useI18n();
const toast = useToast();

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
      body: {
        username: username.value,
        name: name.value || undefined,
        password: password.value,
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

    <form v-else class="space-y-4" @submit.prevent="submit">
      <div class="rounded-lg bg-elevated p-3 space-y-2 text-sm">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-at-sign" class="text-muted" />
          <span class="text-muted">{{ t("invite.emailLabel") }}:</span>
          <span class="font-medium">{{ info?.email }}</span>
        </div>
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-globe" class="text-muted mt-0.5" />
          <span class="text-muted">{{ t("invite.domainsLabel") }}:</span>
          <span v-if="!info?.domains.length" class="italic text-muted">{{ t("invite.allDomains") }}</span>
          <div v-else class="flex flex-wrap gap-1">
            <UBadge v-for="d in info?.domains" :key="d" color="neutral" variant="subtle" size="xs">{{ d }}</UBadge>
          </div>
        </div>
      </div>

      <UFormField :label="t('invite.usernameLabel')" :hint="t('invite.usernameHint')" required>
        <UInput v-model="username" autocomplete="username" pattern="[a-z0-9_.\-]+" minlength="3" class="w-full" required />
      </UFormField>

      <UFormField :label="t('invite.nameLabel')" :hint="t('invite.nameHint')">
        <UInput v-model="name" autocomplete="name" class="w-full" />
      </UFormField>

      <UFormField :label="t('invite.passwordLabel')" required>
        <UInput v-model="password" type="password" autocomplete="new-password" minlength="8" class="w-full" required />
      </UFormField>

      <UButton type="submit" color="primary" block :loading="submitting" icon="i-lucide-user-plus">
        {{ t("invite.submit") }}
      </UButton>
    </form>
  </UCard>
</template>
