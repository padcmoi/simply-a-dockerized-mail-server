<script setup lang="ts">
import { useWindowFocus as useVueWindowFocus } from "@vueuse/core";

const SPIN_MS = 600;

const { t } = useI18n();
const { tick, bump } = useDataRefresh();
const { editing } = useHeartbeatStatus();
const focused = useVueWindowFocus();

const spinning = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(tick, () => {
  if (timer !== null) clearTimeout(timer);

  spinning.value = true;

  timer = setTimeout(() => {
    spinning.value = false;
    timer = null;
  }, SPIN_MS);
});

onScopeDispose(() => {
  if (timer !== null) clearTimeout(timer);
});
</script>

<template>
  <UButton
    v-if="focused"
    :color="editing ? 'warning' : 'neutral'"
    variant="ghost"
    :icon="editing ? 'i-lucide-refresh-cw-off' : 'i-lucide-refresh-cw'"
    :ui="{ leadingIcon: spinning ? 'animate-spin' : '' }"
    :aria-label="t('layout.refreshData')"
    :title="t('layout.refreshData')"
    @click="bump"
  />
</template>
