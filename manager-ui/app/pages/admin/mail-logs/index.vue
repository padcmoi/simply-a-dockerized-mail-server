<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "supervision", action: "access" },
    { resource: "supervision", action: "view-mail-logs" },
  ],
});

await navigateTo("/admin/mail-logs/postfix", { replace: true });
</script>

<template>
  <div />
</template>
