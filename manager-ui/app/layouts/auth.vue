<script setup lang="ts">
const colorMode = useColorMode();
function toggleColorMode() {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
}
</script>

<template>
  <UMain>
    <UContainer class="min-h-dvh flex items-center justify-center py-8">
      <slot />
    </UContainer>
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
