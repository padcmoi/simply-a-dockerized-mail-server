<script setup lang="ts">
import { z } from "zod";
import { useAuthStore } from "~/stores/auth";

const { t, locale } = useI18n();
const { call } = useApi();
const auth = useAuthStore();
const toast = useToast();

const loading = ref(false);
// Read-only: geocoded from the city server-side (see GeocodingService).
const coords = ref<{ latitude: string | null; longitude: string | null }>({ latitude: null, longitude: null });
// The avatar URL is edited in a modal (opened from a pencil on the avatar) rather
// than as a raw field in the form -- a long URL inline is ugly. `avatarDraft`
// holds the edit until Apply, so Cancel reverts.
const avatarModalOpen = ref(false);
const avatarDraft = ref("");
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

const avatarPreview = computed(() => {
  const alt = form.displayName || auth.session?.email || "?";
  return form.avatarUrl.trim() ? { src: form.avatarUrl.trim(), alt } : { alt };
});

// Live preview inside the modal, reflecting the draft URL as it is typed.
const avatarDraftPreview = computed(() => {
  const alt = form.displayName || auth.session?.email || "?";
  const src = avatarDraft.value.trim();
  return src ? { src, alt } : { alt };
});

// All countries, localized name + flag emoji, sorted by name. value = the
// canonical English name so what is stored stays stable across UI locales and
// geocodes reliably (see GeocodingService). The app's locale codes use an
// underscore (`fr_FR`); Intl needs a BCP 47 tag (`fr-FR`), so convert -- an
// underscore tag makes the Intl.DisplayNames constructor throw and would blank
// the whole form. Wrapped defensively so an unknown tag can never break render.
const countryOptions = computed(() => {
  const uiLocale = locale.value.replace(/_/g, "-");
  let enNames: Intl.DisplayNames | null = null;
  let localNames: Intl.DisplayNames | null = null;
  try {
    enNames = new Intl.DisplayNames(["en"], { type: "region" });
    localNames = new Intl.DisplayNames([uiLocale], { type: "region" });
  } catch {
    enNames = null;
    localNames = null;
  }
  return COUNTRY_CODES.map((code) => {
    const name = localNames?.of(code) ?? code;
    return { value: enNames?.of(code) ?? code, label: `${countryFlagEmoji(code)} ${name}`, sortKey: name };
  }).sort((a, b) => a.sortKey.localeCompare(b.sortKey, uiLocale));
});

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

interface MeProfile {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  addressLine: string | null;
  addressComplement: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
}

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

// Void wrapper: an inline `@click="form.country = ''"` returns the assigned
// string, which Vue's void click-handler type rejects.
function clearCountry() {
  form.country = "";
}

function openAvatarModal() {
  avatarDraft.value = form.avatarUrl;
  avatarModalOpen.value = true;
}

function applyAvatar() {
  form.avatarUrl = avatarDraft.value.trim();
  avatarModalOpen.value = false;
}

function closeAvatarModal() {
  avatarModalOpen.value = false;
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
        <div class="relative shrink-0">
          <UAvatar :src="avatarPreview.src" :alt="avatarPreview.alt" size="3xl" />
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            size="xs"
            class="absolute -bottom-1 -end-1 rounded-full ring-2 ring-default"
            :aria-label="t('profile.editAvatar')"
            @click="openAvatarModal"
          />
        </div>
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

      <USeparator :label="t('profile.addressSection')" />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <UFormField :label="t('profile.addressLine')" name="addressLine" class="sm:col-span-2">
          <UInput v-model="form.addressLine" icon="i-lucide-map-pin" class="w-full" />
        </UFormField>

        <UFormField :label="t('profile.addressComplement')" name="addressComplement" class="sm:col-span-2">
          <UInput v-model="form.addressComplement" icon="i-lucide-map-pin" class="w-full" />
        </UFormField>

        <UFormField :label="t('profile.city')" name="city">
          <UInput v-model="form.city" icon="i-lucide-building-2" class="w-full" />
        </UFormField>

        <UFormField :label="t('profile.postalCode')" name="postalCode">
          <UInput v-model="form.postalCode" class="w-full" />
        </UFormField>

        <UFormField :label="t('profile.country')" name="country">
          <USelectMenu
            v-model="form.country"
            value-key="value"
            :items="countryOptions"
            :placeholder="t('profile.countryPlaceholder')"
            icon="i-lucide-globe"
            class="w-full"
          >
            <!-- Country is optional: a clear button (replacing the chevron once a
                 value is set) empties the field back to no country. -->
            <template #trailing>
              <UButton
                v-if="form.country"
                icon="i-lucide-x"
                color="neutral"
                variant="link"
                size="xs"
                :aria-label="t('common.clear')"
                @mousedown.stop.prevent
                @click.stop="clearCountry"
              />
              <UIcon v-else name="i-lucide-chevron-down" class="size-5 text-dimmed" />
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField :label="t('profile.coordinates')">
          <div class="flex items-center gap-2 text-sm py-1.5">
            <UIcon name="i-lucide-locate-fixed" class="text-dimmed shrink-0" />
            <span v-if="coords.latitude && coords.longitude">{{ coords.latitude }}, {{ coords.longitude }}</span>
            <span v-else class="text-muted">{{ t("profile.coordinatesEmpty") }}</span>
          </div>
        </UFormField>
      </div>

      <div class="flex justify-end">
        <UButton type="submit" :loading="loading" icon="i-lucide-save" color="primary">
          {{ t("profile.save") }}
        </UButton>
      </div>
    </UForm>

    <UModal v-model:open="avatarModalOpen" :title="t('profile.avatarUrl')">
      <template #body>
        <div class="space-y-4">
          <div class="flex justify-center">
            <UAvatar :src="avatarDraftPreview.src" :alt="avatarDraftPreview.alt" size="3xl" />
          </div>
          <UFormField :label="t('profile.avatarUrl')" :description="t('profile.avatarUrlHint')">
            <UInput v-model="avatarDraft" type="url" placeholder="https://..." icon="i-lucide-image" class="w-full" autofocus />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="closeAvatarModal">{{ t("common.cancel") }}</UButton>
          <UButton color="primary" icon="i-lucide-check" @click="applyAvatar">{{ t("common.apply") }}</UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
