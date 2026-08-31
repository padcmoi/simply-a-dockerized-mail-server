<script setup lang="ts">
const colorMode = useColorMode();
function toggleColorMode() {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
}

// The release the server is running, named before anyone has signed in. It is
// the API's answer and not a constant on this side: the front would otherwise
// show the version it was built from, not the one answering it.
const RELEASES_URL = "https://github.com/padcmoi/simply-a-dockerized-mail-server/releases/tag";

const { call } = useApi();

const { data: info, pending } = useAsyncData("api-info", () => call<{ code_version: string }>(""), { server: false });
</script>

<template>
  <UMain>
    <UContainer class="min-h-dvh flex items-center justify-center py-8">
      <slot />
    </UContainer>

    <div class="fixed bottom-3 right-3">
      <USkeleton v-if="pending" class="h-6 w-28" />
      <UButton
        v-else-if="info"
        :to="`${RELEASES_URL}/${info.code_version}`"
        target="_blank"
        rel="noopener noreferrer"
        external
        color="secondary"
        variant="subtle"
        size="xs"
        icon="i-lucide-tag"
        :ui="{ leadingIcon: 'size-3' }"
      >
        {{ info.code_version }}
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
