<script setup lang="ts">
import type { PostfixQueueStats } from "~/composables/useDomainDashboard";

defineProps<{
  queue: PostfixQueueStats | null;
}>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t("domainDashboard.postfix.title") }}</h2>
    </template>
    <UAlert
      v-if="queue && !queue.available"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      :title="t('domainDashboard.postfix.unavailable')"
    />
    <div v-else-if="queue" class="space-y-3 text-sm">
      <div class="text-xs font-semibold text-muted uppercase tracking-wide flex gap-4">
        <span class="flex-1">{{ t("domainDashboard.postfix.global") }}</span>
        <span class="w-20 text-right">{{ t("domainDashboard.postfix.forDomain") }}</span>
      </div>
      <template v-for="dir in ['active', 'deferred', 'hold', 'incoming']" :key="dir">
        <div class="flex items-center justify-between py-1 border-b border-default last:border-0">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="{
                'bg-success': dir === 'active',
                'bg-warning': dir === 'deferred',
                'bg-error': dir === 'hold',
                'bg-primary': dir === 'incoming',
              }"
            />
            <span class="text-muted">{{ t(`domainDashboard.postfix.${dir}`) }}</span>
          </div>
          <div class="flex gap-4">
            <span class="font-semibold w-8 text-right">{{ queue.total[dir as keyof typeof queue.total] }}</span>
            <span class="w-20 text-right font-medium text-primary">
              {{ queue.domain?.[dir as keyof typeof queue.domain] ?? "-" }}
            </span>
          </div>
        </div>
      </template>
    </div>
    <div v-else class="flex justify-center py-4">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>
  </UCard>
</template>
