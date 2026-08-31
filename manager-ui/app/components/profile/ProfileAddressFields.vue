<script setup lang="ts">
// Address section of a profile form: street, complement, city, postal code,
// country (searchable select of every country with a flag and a clear button)
// and the read-only geocoded coordinates. Shared by the profile page and the
// admin account edit page; the parent owns the UForm and the validation schema,
// each UFormField name matching a schema key. Latitude/longitude are derived
// server-side from the city (see GeocodingService), hence read-only here.
const addressLine = defineModel<string>("addressLine", { required: true });
const addressComplement = defineModel<string>("addressComplement", { required: true });
const city = defineModel<string>("city", { required: true });
const postalCode = defineModel<string>("postalCode", { required: true });
const country = defineModel<string>("country", { required: true });
defineProps<{ coords: { latitude: string | null; longitude: string | null } }>();

const { t } = useI18n();
const countryOptions = useCountryOptions();

function clearCountry() {
  country.value = "";
}
</script>

<template>
  <div class="space-y-6">
    <USeparator :label="t('profile.addressSection')" />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
      <UFormField :label="t('profile.addressLine')" name="addressLine" class="sm:col-span-2">
        <UInput v-model="addressLine" icon="i-lucide-map-pin" class="w-full" />
      </UFormField>

      <UFormField :label="t('profile.addressComplement')" name="addressComplement" class="sm:col-span-2">
        <UInput v-model="addressComplement" icon="i-lucide-map-pin" class="w-full" />
      </UFormField>

      <UFormField :label="t('profile.city')" name="city">
        <UInput v-model="city" icon="i-lucide-building-2" class="w-full" />
      </UFormField>

      <UFormField :label="t('profile.postalCode')" name="postalCode">
        <UInput v-model="postalCode" class="w-full" />
      </UFormField>

      <UFormField :label="t('profile.country')" name="country">
        <USelectMenu
          v-model="country"
          value-key="value"
          :items="countryOptions"
          :placeholder="t('profile.countryPlaceholder')"
          icon="i-lucide-globe"
          class="w-full"
        >
          <template #trailing>
            <UButton
              v-if="country"
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
  </div>
</template>
