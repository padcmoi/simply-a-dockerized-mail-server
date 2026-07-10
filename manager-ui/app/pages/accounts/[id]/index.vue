<script setup lang="ts">
interface AccountDetail {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isRoot: boolean;
  enabled: boolean;
  groups: { id: string; name: string }[];
}

definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "view-account" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

const account = ref<AccountDetail | null>(null);
const loading = ref(false);
const saving = ref(false);
const form = reactive({ name: "", email: "", avatarUrl: "", enabled: true });

const accountId = computed(() => String(route.params.id));

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.accounts"), to: "/accounts" }, { label: account.value?.username ?? "..." }]);
});

async function load() {
  loading.value = true;
  try {
    account.value = await call<AccountDetail>(`/accounts/${accountId.value}`);
    form.name = account.value.name ?? "";
    form.email = account.value.email ?? "";
    form.avatarUrl = account.value.avatarUrl ?? "";
    form.enabled = account.value.enabled;
  } catch (e) {
    toast.add({ title: t("accounts.editPage.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    account.value = await call<AccountDetail>(`/accounts/${accountId.value}`, {
      method: "PATCH",
      body: {
        name: form.name || null,
        email: form.email || null,
        avatarUrl: form.avatarUrl || null,
        enabled: form.enabled,
      },
    });
    toast.add({ title: t("accounts.editPage.toast.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("accounts.editPage.toast.saveFailed"), description: (e as Error).message, color: "error" });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-user-cog"
      :title="t('accounts.editPage.alertTitle')"
      :description="t('accounts.editPage.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/accounts" size="sm">
      {{ t("accounts.backToList") }}
    </UButton>

    <div v-if="loading && !account" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <UCard v-else-if="account">
      <template #header>
        <h2 class="font-semibold truncate">{{ t("accounts.editPage.title", { username: account.username }) }}</h2>
      </template>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField :label="t('accounts.editPage.nameLabel')">
          <UInput v-model="form.name" class="w-full" />
        </UFormField>
        <UFormField :label="t('accounts.editPage.emailLabel')">
          <UInput v-model="form.email" type="email" class="w-full" />
        </UFormField>
        <UFormField :label="t('accounts.editPage.avatarUrlLabel')" class="sm:col-span-2">
          <UInput v-model="form.avatarUrl" type="url" class="w-full" />
        </UFormField>
      </div>
      <UFormField :label="t('accounts.editPage.enabledLabel')" :description="t('accounts.editPage.enabledHint')" class="mt-4">
        <USwitch v-model="form.enabled" />
      </UFormField>

      <template #footer>
        <div class="flex justify-end">
          <UButton color="primary" :loading="saving" @click="save">{{ t("accounts.editPage.save") }}</UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
