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
    <UButton
      :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
      color="neutral"
      variant="ghost"
      class="fixed top-3 right-3"
      square
      @click="toggleColorMode"
    />
  </UMain>
</template>
