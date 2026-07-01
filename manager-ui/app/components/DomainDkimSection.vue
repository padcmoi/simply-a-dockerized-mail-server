<script setup lang="ts">
import type { DkimKey } from "~/composables/useDomainDashboard";

const emit = defineEmits<{
  rotate: [];
  delete: [selector: string];
  copy: [text: string];
}>();

const props = defineProps<{
  keys: DkimKey[];
  loading: boolean;
}>();

const open = ref(true);
const confirmDeleteOpen = ref(false);
const confirmActionOpen = ref(false);
const pendingSelector = ref<string | null>(null);

const confirmActionTitle = computed(() =>
  props.keys.length > 0 ? t("domainDashboard.dkim.confirmRotate") : t("domainDashboard.dkim.confirmGenerate")
);
const confirmActionDesc = computed(() =>
  props.keys.length > 0 ? t("domainDashboard.dkim.confirmRotateDesc") : t("domainDashboard.dkim.confirmGenerateDesc")
);

const { t } = useI18n();

function requestDelete(selector: string) {
  pendingSelector.value = selector;
  confirmDeleteOpen.value = true;
}

function onDeleteConfirmed() {
  if (pendingSelector.value) emit("delete", pendingSelector.value);
  pendingSelector.value = null;
}

function onActionConfirmed() {
  emit("rotate");
}
</script>

<template>
  <UCollapsible v-model:open="open" class="border border-default rounded-lg">
    <div class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none">
      <UIcon name="i-lucide-key" class="text-warning" />
      <h2 class="font-semibold">{{ t("domainDashboard.dkim.title") }}</h2>
      <UIcon name="i-lucide-chevron-down" class="text-muted transition-transform duration-200" :class="{ '-rotate-180': open }" />
    </div>

    <template #content>
      <div class="border-t border-default px-4 pb-4 pt-3 space-y-4">
        <div v-if="props.loading && props.keys.length === 0" class="flex justify-center py-6">
          <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
        </div>

        <UEmptyState
          v-else-if="!props.loading && props.keys.length === 0"
          icon="i-lucide-key"
          :title="t('domainDashboard.dkim.noKey')"
        >
          <template #actions>
            <UButton
              icon="i-lucide-plus"
              color="primary"
              :loading="props.loading"
              @click="
                () => {
                  confirmActionOpen = true;
                }
              "
            >
              {{ t("domainDashboard.dkim.generate") }}
            </UButton>
          </template>
        </UEmptyState>

        <div v-else class="space-y-4">
          <div v-for="key in props.keys" :key="key.selector" class="border border-default rounded-lg p-4 space-y-3">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2 min-w-0 flex-wrap">
                <UIcon name="i-lucide-key" class="text-warning shrink-0" />
                <span class="font-mono text-sm font-semibold">{{ key.selector }}</span>
                <div class="flex items-center gap-1">
                  <UBadge color="neutral" variant="subtle" class="font-mono text-xs truncate max-w-[200px]">
                    {{ key.dnsName }}
                  </UBadge>
                  <UButton
                    icon="i-lucide-copy"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    square
                    :title="key.dnsName"
                    @click.stop="emit('copy', key.dnsName)"
                  />
                </div>
              </div>
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                square
                @click="requestDelete(key.selector)"
              />
            </div>
            <div class="bg-elevated rounded-md p-3">
              <div class="flex items-start justify-between gap-2">
                <p class="font-mono text-xs break-all text-muted leading-relaxed flex-1">
                  {{ key.txtRecord }}
                </p>
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  class="shrink-0"
                  @click="emit('copy', key.txtRecord)"
                />
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-1">
            <UButton
              icon="i-lucide-rotate-cw"
              size="sm"
              color="warning"
              variant="soft"
              :loading="props.loading"
              @click="
                () => {
                  confirmActionOpen = true;
                }
              "
            >
              {{ t("domainDashboard.dkim.rotate") }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UCollapsible>

  <ConfirmModal v-model:open="confirmDeleteOpen" @confirm="onDeleteConfirmed" />
  <ConfirmModal
    v-model:open="confirmActionOpen"
    :title="confirmActionTitle"
    :description="confirmActionDesc"
    @confirm="onActionConfirmed"
  />
</template>
