<script setup lang="ts">
const emit = defineEmits<{ unban: [ip: string] }>();

const { jail, canUnban, busy } = defineProps<{ jail: Fail2banJail; canUnban: boolean; busy: string | null }>();

const { t, locale } = useI18n();

const rule = computed(() =>
  jail.bantime < 0
    ? t("fail2ban.permanentRule")
    : t("fail2ban.rule", {
        maxretry: jail.maxretry,
        findtime: formatSeconds(jail.findtime, t),
        bantime: formatSeconds(jail.bantime, t),
      })
);

const figures = computed(() => [
  { label: t("fail2ban.currentlyBanned"), value: jail.currentlyBanned },
  { label: t("fail2ban.totalBanned"), value: jail.totalBanned },
  { label: t("fail2ban.currentlyFailed"), value: jail.currentlyFailed },
  { label: t("fail2ban.totalFailed"), value: jail.totalFailed },
]);
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="flex items-center gap-2 font-medium">
          <UIcon name="i-lucide-shield-ban" class="size-4 text-primary" />
          {{ jail.name }}
        </span>
        <span class="text-xs text-dimmed">
          {{ rule }}
        </span>
      </div>
    </template>

    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div v-for="figure in figures" :key="figure.label" class="rounded-md border border-default p-3">
          <p class="text-xs text-dimmed">{{ figure.label }}</p>
          <p class="text-lg font-semibold">{{ figure.value }}</p>
        </div>
      </div>

      <p v-if="!jail.bans.length" class="text-sm text-muted">{{ t("fail2ban.noBan") }}</p>
      <div v-else class="divide-y divide-default text-sm">
        <div v-for="ban in jail.bans" :key="ban.ip" class="flex flex-wrap items-center justify-between gap-2 py-2">
          <div class="min-w-0">
            <p class="font-mono select-text">{{ ban.ip }}</p>
            <p class="text-xs text-dimmed">
              {{ t("fail2ban.since", { at: formatStamp(ban.bannedAt, locale) }) }}
              ·
              {{ ban.expiresAt ? t("fail2ban.until", { at: formatStamp(ban.expiresAt, locale) }) : t("fail2ban.forever") }}
            </p>
          </div>
          <UButton
            v-if="canUnban"
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-shield-check"
            :label="t('fail2ban.unban')"
            :loading="busy === `unban:${jail.name}:${ban.ip}`"
            @click="emit('unban', ban.ip)"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
