<script setup lang="ts">
const emit = defineEmits<{ ban: [ip: string] }>();

const { busy } = defineProps<{ busy: string | null }>();

const { t } = useI18n();

const ip = ref("");

const IP = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-f:]*:[0-9a-f:.]*)$/i;

const valid = computed(() => IP.test(ip.value.trim()));

function submit() {
  if (valid.value) emit("ban", ip.value.trim());
}

defineExpose({ clear: () => (ip.value = "") });
</script>

<template>
  <UCard>
    <template #header>
      <div class="space-y-1">
        <span class="flex items-center gap-2 font-medium">
          <UIcon name="i-lucide-ban" class="size-4 text-primary" />
          {{ t("fail2ban.banTitle") }}
        </span>
        <p class="text-xs text-dimmed">{{ t("fail2ban.banHint") }}</p>
      </div>
    </template>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="submit">
      <UFormField :label="t('fail2ban.address')">
        <UInput v-model="ip" placeholder="203.0.113.9" class="w-64" />
      </UFormField>
      <UButton
        type="submit"
        color="error"
        icon="i-lucide-ban"
        :label="t('fail2ban.ban')"
        :disabled="!valid"
        :loading="!!busy?.startsWith('ban:')"
      />
    </form>
  </UCard>
</template>
