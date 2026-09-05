<script setup lang="ts">
import { useCodeVersion } from "~/composables/useCodeVersion";

const colorMode = useColorMode();
function toggleColorMode() {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
}

const { version, pending, releaseUrl } = useCodeVersion();
</script>

<template>
  <UMain>
    <UContainer class="min-h-dvh flex items-center justify-center py-8">
      <slot />
    </UContainer>

    <div class="fixed bottom-3 right-3">
      <USkeleton v-if="pending" class="h-6 w-28" />
      <UButton
        v-else-if="releaseUrl"
        :to="releaseUrl"
        target="_blank"
        rel="noopener noreferrer"
        external
        color="neutral"
        variant="subtle"
        size="xs"
        icon="i-lucide-tag"
        :ui="{ leadingIcon: 'size-3' }"
      >
        {{ version }}
      </UButton>
    </div>

    <div class="fixed top-3 right-3 flex items-center gap-1">
      <LocaleSwitcher />

      <UButton
        :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="ghost"
        square
        @click="toggleColorMode"
      />
    </div>
  </UMain>
</template>
