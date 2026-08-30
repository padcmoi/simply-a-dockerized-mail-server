<script setup lang="ts">
import { z } from "zod";

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

const account = ref<AccountEditView | null>(null);
const loading = ref(false);
const saving = ref(false);
// Read-only: geocoded from the city server-side (see GeocodingService).
const coords = ref<{ latitude: string | null; longitude: string | null }>({ latitude: null, longitude: null });
const form = reactive({
  email: "",
  displayName: "",
  avatarUrl: "",
  phone: "",
  addressLine: "",
  addressComplement: "",
  city: "",
  postalCode: "",
  country: "",
  enabled: true,
});

const accountId = computed(() => String(route.params.id));
const avatarAlt = computed(() => form.displayName || form.email || "?");

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.accounts"), to: "/admin/accounts" },
    { label: account.value?.email ?? "...", to: `/admin/accounts/${accountId.value}` },
    { label: t("accounts.editPage.breadcrumb") },
  ]);
});

const schema = z.object({
  email: z.email(t("profile.emailInvalid")).max(255).or(z.literal("")).optional(),
  displayName: z.string().max(255).optional(),
  avatarUrl: z.url(t("profile.urlInvalid")).max(1024).or(z.literal("")).optional(),
  phone: z.string().max(32).optional(),
  addressLine: z.string().max(255).optional(),
  addressComplement: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  postalCode: z.string().max(32).optional(),
  country: z.string().max(255).optional(),
});

function fillForm(a: AccountEditView) {
  form.email = a.email ?? "";
  form.displayName = a.displayName ?? "";
  form.avatarUrl = a.avatarUrl ?? "";
  form.phone = a.phone ?? "";
  form.addressLine = a.addressLine ?? "";
  form.addressComplement = a.addressComplement ?? "";
  form.city = a.city ?? "";
  form.postalCode = a.postalCode ?? "";
  form.country = a.country ?? "";
  form.enabled = a.enabled;
  coords.value = { latitude: a.latitude, longitude: a.longitude };
}

async function load() {
  loading.value = true;
  try {
    account.value = await call<AccountEditView>(`/accounts/${accountId.value}`);
    fillForm(account.value);
  } catch (e) {
    toast.add({ title: t("accounts.editPage.toast.loadFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    // email is the login identity and cannot be cleared: only send it when set.
    account.value = await call<AccountEditView>(`/accounts/${accountId.value}/edit`, {
      method: "PATCH",
      body: {
        email: form.email.trim() || undefined,
        displayName: form.displayName.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        phone: form.phone.trim() || null,
        addressLine: form.addressLine.trim() || null,
        addressComplement: form.addressComplement.trim() || null,
        city: form.city.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        enabled: form.enabled,
      },
    });
    fillForm(account.value);
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
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-user-cog"
      :title="t('accounts.editPage.alertTitle')"
      :description="t('accounts.editPage.alertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/accounts" size="sm">
      {{ t("accounts.backToList") }}
    </UButton>

    <div v-if="loading && !account" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <UCard v-else-if="account">
      <template #header>
        <h2 class="font-semibold truncate">{{ t("accounts.editPage.title", { email: account.email }) }}</h2>
      </template>

      <UForm :schema="schema" :state="form" class="space-y-6" @submit="save">
        <div class="flex items-center gap-4">
          <ProfileAvatarEditField v-model="form.avatarUrl" :alt="avatarAlt" />
          <div class="min-w-0">
            <p class="font-medium truncate">{{ account.email }}</p>
            <div class="flex flex-wrap gap-1">
              <UBadge v-if="account.isRoot" color="warning" variant="subtle" icon="i-lucide-shield">
                {{ t("layout.rootBadge") }}
              </UBadge>
              <template v-else-if="account.groups.length">
                <UBadge
                  v-for="group in account.groups"
                  :key="group.id"
                  color="primary"
                  variant="subtle"
                  icon="i-lucide-users-round"
                  class="max-w-48"
                >
                  <span class="truncate">{{ group.name }}</span>
                </UBadge>
              </template>
              <UBadge v-else color="neutral" variant="subtle" icon="i-lucide-user-x">
                {{ t("layout.noGroupBadge") }}
              </UBadge>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <UFormField :label="t('accounts.editPage.emailLabel')" name="email">
            <UInput v-model="form.email" type="email" placeholder="jane@example.com" icon="i-lucide-mail" class="w-full" />
          </UFormField>

          <UFormField :label="t('accounts.editPage.nameLabel')" name="displayName">
            <UInput v-model="form.displayName" placeholder="Jane Doe" icon="i-lucide-user" class="w-full" />
          </UFormField>

          <UFormField :label="t('profile.phone')" name="phone">
            <UInput v-model="form.phone" icon="i-lucide-phone" class="w-full" />
          </UFormField>
        </div>

        <ProfileAddressFields
          v-model:address-line="form.addressLine"
          v-model:address-complement="form.addressComplement"
          v-model:city="form.city"
          v-model:postal-code="form.postalCode"
          v-model:country="form.country"
          :coords="coords"
        />

        <USeparator />

        <UFormField :label="t('accounts.editPage.enabledLabel')" :description="t('accounts.editPage.enabledHint')">
          <USwitch v-model="form.enabled" />
        </UFormField>

        <div class="flex justify-end">
          <UButton type="submit" color="primary" :loading="saving" icon="i-lucide-save">
            {{ t("accounts.editPage.save") }}
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
