<script setup lang="ts">
const { t } = useI18n();
const theme = useThemeColors();
const {
  aliases,
  steps,
  surfaces,
  mode,
  touched,
  valueOf,
  isPicked,
  isAliasPicked,
  setValue,
  setAlias,
  apply,
  refreshSeeds,
  reset,
} = theme;

// The mode changes under our feet whenever the appearance toggle is used, or
// when the system flips it; the pickers have to follow the theme now on screen.
watch(mode, refreshSeeds);

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
      <UButton icon="i-lucide-rotate-ccw" color="neutral" variant="subtle" size="sm" :disabled="!touched" @click="reset">
        {{ t("preferences.themeColorsReset") }}
      </UButton>
    </div>

    <div class="space-y-3">
      <div v-for="alias in aliases" :key="alias" class="flex flex-wrap items-end gap-3">
        <div class="w-40 shrink-0">
          <ColorSwatchField
            :label="alias"
            :model-value="valueOf(theme.stepVar(alias, 500))"
            :picked="isAliasPicked(alias)"
            @update:model-value="setAlias(alias, $event)"
          />
        </div>
        <!-- The eleven steps are shown, not offered: they are what the lead
             colour above produces, an estimate of the ramp rather than eleven
             more things to decide. -->
        <div class="flex flex-wrap gap-1 pb-1.5">
          <span
            v-for="step in steps"
            :key="step"
            :title="`${alias}-${step}`"
            class="size-5 rounded ring ring-accented"
            :style="{ backgroundColor: valueOf(theme.stepVar(alias, step)) }"
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

    <p class="mt-4 text-sm text-muted">{{ t("preferences.themeColorsHint") }}</p>
  </UCard>
</template>
