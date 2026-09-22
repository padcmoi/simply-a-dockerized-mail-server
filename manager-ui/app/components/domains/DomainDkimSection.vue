<script setup lang="ts">
const emit = defineEmits<{
  rotate: [];
  recheck: [];
  delete: [selector: string];
  copy: [text: string];
}>();

const props = defineProps<{
  keys: DkimKey[];
  loading: boolean;
  checkResult: DkimCheckResult | null;
  checking: boolean;
}>();

// The check endpoint only ever evaluates the current (latest) selector, so
// the badge only applies to the row it actually checked, not every row --
// matters if a stale/previous-month key is still lingering in `keys`.
function matchFor(selector: string) {
  if (!props.checkResult || props.checkResult.expected?.selector !== selector) return null;
  return props.checkResult.match;
}

function checkedRow(selector: string, index: number) {
  const expected = props.checkResult?.expected?.selector;
  return expected ? expected === selector : index === 0;
}

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
  <div class="space-y-4">
    <div v-if="props.loading && props.keys.length === 0" class="flex justify-center py-6">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <div v-else-if="!props.loading && props.keys.length === 0" class="flex flex-col items-center gap-3 py-6 text-center">
      <UIcon name="i-lucide-key" class="text-3xl text-muted" />
      <p class="text-sm text-muted">{{ t("domainDashboard.dkim.noKey") }}</p>
      <UButton
        icon="i-lucide-plus"
        color="primary"
        @click="
          () => {
            confirmActionOpen = true;
          }
        "
      >
        {{ t("domainDashboard.dkim.generate") }}
      </UButton>
    </div>

    <div v-else class="space-y-6">
      <ContentPanel v-for="(key, index) in props.keys" :key="key.selector" class="space-y-3">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2 min-w-0 flex-wrap">
            <UIcon name="i-lucide-key" class="text-warning shrink-0" />
            <span class="font-mono text-sm font-semibold">{{ key.selector }}</span>
            <div class="flex items-center gap-1">
              <UTooltip
                v-if="matchFor(key.selector) !== null"
                :text="matchFor(key.selector) ? t('domainDashboard.dkim.dnsMatch') : t('domainDashboard.dkim.dnsMismatch')"
              >
                <UBadge
                  :color="matchFor(key.selector) ? 'success' : 'error'"
                  variant="subtle"
                  :icon="matchFor(key.selector) ? 'i-lucide-shield-check' : 'i-lucide-shield-x'"
                >
                  DKIM
                </UBadge>
              </UTooltip>

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
          <div class="flex items-center gap-1">
            <UButton
              v-if="checkedRow(key.selector, index)"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="props.checking"
              @click="emit('recheck')"
            >
              {{ t("domainDashboard.dkim.recheck") }}
            </UButton>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              square
              @click="requestDelete(key.selector)"
            />
          </div>
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
        <div v-if="props.checkResult?.expected?.selector === key.selector" class="text-xs">
          <p class="text-muted">{{ t("domainDashboard.dkim.published") }}</p>
          <p v-if="props.checkResult.found" class="font-mono break-all text-dimmed mt-1">{{ props.checkResult.found.value }}</p>
          <p v-else class="text-warning mt-1">{{ t("domainDashboard.dkim.notPublished") }}</p>
        </div>
        <div class="flex justify-end">
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
      </ContentPanel>
    </div>
  </div>

  <ConfirmModal v-model:open="confirmDeleteOpen" @confirm="onDeleteConfirmed" />
  <ConfirmModal
    v-model:open="confirmActionOpen"
    type="warning"
    :title="confirmActionTitle"
    :description="confirmActionDesc"
    @confirm="onActionConfirmed"
  />
</template>
