<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

const { t } = useI18n();
const { call } = useApi();
const auth = useAuthStore();
const toast = useToast();

const loading = ref(false);
// Read-only: geocoded from the city server-side (see GeocodingService).
const coords = ref<{ latitude: string | null; longitude: string | null }>({ latitude: null, longitude: null });
const form = reactive({
  displayName: "",
  email: "",
  avatarUrl: "",
  phone: "",
  addressLine: "",
  addressComplement: "",
  city: "",
  postalCode: "",
  country: "",
});

const avatarAlt = computed(() => form.displayName || auth.session?.email || "?");

const schema = z.object({
  displayName: z.string().max(255).optional(),
  email: z.string().email(t("profile.emailInvalid")).max(255).or(z.literal("")).optional(),
  avatarUrl: z.string().url(t("profile.urlInvalid")).max(1024).or(z.literal("")).optional(),
  phone: z.string().max(32).optional(),
  addressLine: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  postalCode: z.string().max(32).optional(),
  country: z.string().max(255).optional(),
});

// Populates the form from the full /me profile (the session only keeps a subset).
async function fetchProfileForm() {
  const me = await call<MeProfile>("/auth/jwt/me");
  form.displayName = me.displayName ?? "";
  form.email = me.email;
  form.avatarUrl = me.avatarUrl ?? "";
  form.phone = me.phone ?? "";
  form.addressLine = me.addressLine ?? "";
  form.addressComplement = me.addressComplement ?? "";
  form.city = me.city ?? "";
  form.postalCode = me.postalCode ?? "";
  form.country = me.country ?? "";
  coords.value = { latitude: me.latitude, longitude: me.longitude };
}

async function save() {
  loading.value = true;
  try {
    // email is the login identity and cannot be cleared: only send it when set.
    await auth.updateProfile({
      displayName: form.displayName.trim() || null,
      email: form.email.trim() || undefined,
      avatarUrl: form.avatarUrl.trim() || null,
      phone: form.phone.trim() || null,
      addressLine: form.addressLine.trim() || null,
      addressComplement: form.addressComplement.trim() || null,
      city: form.city.trim() || null,
      postalCode: form.postalCode.trim() || null,
      country: form.country.trim() || null,
    });
    await fetchProfileForm();
    toast.add({ title: t("profile.toast.updated"), color: "success" });
  } catch (e) {
    toast.add({ title: t("profile.toast.updateFailed"), description: (e as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

// See profile.vue's own note on why `status` (not `pending`) gates the skeleton.
const { status: identityStatus } = useAsyncData(
  "profile-identity",
  async () => {
    try {
      await auth.fetchProfile();
      await fetchProfileForm();
    } catch (e) {
      toast.add({ title: t("profile.toast.loadFailed"), description: (e as Error).message, color: "error" });
    }
    return null;
  },
  { server: false }
);
const identityLoading = computed(() => identityStatus.value !== "success" && identityStatus.value !== "error");
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t("profile.identity") }}</h2>
    </template>
    <div v-if="identityLoading" class="space-y-6">
      <div class="flex items-center gap-4">
        <USkeleton class="w-16 h-16 rounded-full shrink-0" />
        <div class="space-y-2">
          <USkeleton class="h-4 w-32" />
          <USkeleton class="h-5 w-24" />
        </div>
      </div>
      <USkeleton v-for="i in 4" :key="i" class="h-9 w-full" />
    </div>
    <UForm v-else :schema="schema" :state="form" class="space-y-6" @submit="save">
      <div class="flex items-center gap-4">
        <ProfileAvatarEditField v-model="form.avatarUrl" :alt="avatarAlt" />
        <div class="min-w-0">
          <p class="font-medium truncate">{{ auth.session?.email }}</p>
          <div class="flex flex-wrap gap-1">
            <UBadge v-if="auth.session?.isRoot" color="warning" variant="subtle" icon="i-lucide-shield">
              {{ t("layout.rootBadge") }}
            </UBadge>
            <template v-else-if="auth.session?.groups?.length">
              <UBadge
                v-for="group in auth.session.groups"
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
        <UFormField :label="t('profile.email')" name="email">
          <UInput v-model="form.email" type="email" placeholder="jane@example.com" icon="i-lucide-mail" class="w-full" />
        </UFormField>

        <UFormField :label="t('profile.displayName')" name="displayName">
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

      <div class="flex justify-end">
        <UButton type="submit" :loading="loading" icon="i-lucide-save" color="primary">
          {{ t("profile.save") }}
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
