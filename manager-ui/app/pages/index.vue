<script setup lang="ts">
definePageMeta({ layout: false });
// SSR-side redirect: navigateTo from a script-setup top level redirects before
// the page renders (no flash). useToast/useApi etc. are not needed here.
await navigateTo("/my-space", { replace: true });
</script>

<template>
  <UMain>
    <UContainer class="min-h-dvh flex items-center justify-center">
      <UProgress animation="carousel" />
    </UContainer>
  </UMain>
</template>
