<script setup lang="ts">
// The bench for one mode at a time: the seven accents Nuxt UI derives its
// components from, then the surfaces painted on top of them. Switching light and
// dark swaps the whole set, since the two themes are held apart.
//
// `scope` decides whose theme is being written: the account's own, from the
// preferences, or the server-wide one everybody lands on, from the
// administration. The controls are the same, the layer underneath is not.
const { scope = "account" } = defineProps<{ scope?: ThemeScope }>();

const { t } = useI18n();
const {
  aliases,
  surfaces,
  steps,
  mode,
  touched,
  saving,
  valueOf,
  isPicked,
  setValue,
  apply,
  refreshSeeds,
  reset,
  save,
  exportFile,
  importFile,
} = useThemeColors(scope);

// The file input stays hidden and is driven by the button next to it: a raw file
// field would sit in a row of controls looking like none of them.
const picker = useTemplateRef<HTMLInputElement>("picker");

// The mode changes under our feet whenever the appearance toggle is used, or
// when the system flips it; the pickers have to follow the theme now on screen.
watch(mode, refreshSeeds);

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await importFile(file);
  // Cleared either way, so choosing the same file twice in a row still fires.
  input.value = "";
}

onMounted(() => {
  apply();
  refreshSeeds();
});
</script>

<template>
  <UCard>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">
        {{ t(mode === "dark" ? "preferences.themeColorsDark" : "preferences.themeColorsLight") }}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <UButton icon="i-lucide-download" color="neutral" variant="subtle" size="sm" @click="exportFile">
          {{ t("preferences.themeExport") }}
        </UButton>
        <UButton icon="i-lucide-upload" color="neutral" variant="subtle" size="sm" @click="picker?.click()">
          {{ t("preferences.themeImportLabel") }}
        </UButton>
        <input ref="picker" type="file" accept="application/json,.json" class="hidden" @change="onFile" />
        <UButton icon="i-lucide-rotate-ccw" color="neutral" variant="subtle" size="sm" :disabled="!touched" @click="reset">
          {{ t("preferences.themeColorsReset") }}
        </UButton>
        <UButton icon="i-lucide-check" size="sm" :loading="saving" @click="save">
          {{ t("common.save") }}
        </UButton>
      </div>
    </div>

    <div class="space-y-3">
      <div v-for="alias in aliases" :key="alias" class="flex flex-wrap items-end gap-3">
        <div class="w-40 shrink-0">
          <ColorSwatchField
            :label="alias"
            :model-value="valueOf(alias)"
            :picked="isPicked(alias)"
            @update:model-value="setValue(alias, $event)"
          />
        </div>
        <!-- The eleven steps are shown, not offered: they are what the colour
             above produces, an estimate of the ramp rather than eleven more
             things to decide. -->
        <div class="flex flex-wrap gap-1 pb-1.5">
          <span
            v-for="(shade, index) in themeRamp(valueOf(alias))"
            :key="steps[index]"
            :title="`${alias}-${steps[index]}`"
            class="size-5 rounded ring ring-accented"
            :style="{ backgroundColor: shade }"
          />
        </div>
      </div>
    </div>

    <USeparator class="my-5" />

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
      <ColorSwatchField
        v-for="token in surfaces"
        :key="token"
        :label="token.replace('--ui-', '')"
        :model-value="valueOf(token)"
        :picked="isPicked(token)"
        @update:model-value="setValue(token, $event)"
      />
    </div>

    <p class="mt-4 text-sm text-muted">
      {{ t(scope === "app" ? "config.theme.hint" : "preferences.themeColorsHint") }}
    </p>
  </UCard>
</template>
