<script setup lang="ts">
import type { RspamdActionThresholds, SaveRspamdActionsInput } from "~/composables/useRspamdActions";

const emit = defineEmits<{ save: [SaveRspamdActionsInput]; reset: [] }>();
const props = defineProps<{
  actions: RspamdActionThresholds | null;
  loading: boolean;
  canEdit: boolean;
}>();

const { t } = useI18n();

const confirmResetOpen = ref(false);
const form = reactive<SaveRspamdActionsInput>({ greylist: null, addHeader: null, rewriteSubject: null, reject: null });

// Same rule as the API (rspamd.validation.ts): non-negative, and read
// top-to-bottom on the form (greylist -> add header -> rewrite subject ->
// reject) the non-null values must be strictly ascending -- i.e. reject is
// the highest score threshold, greylist the lowest.
const negativeError = computed(() =>
  [form.greylist, form.addHeader, form.rewriteSubject, form.reject].some((n) => n !== null && n < 0)
);
const orderError = computed(() => {
  let previous = null as number | null;
  for (const n of [form.greylist, form.addHeader, form.rewriteSubject, form.reject]) {
    if (n === null) continue;
    if (previous !== null && n <= previous) return true;
    previous = n;
  }
  return false;
});
const hasError = computed(() => negativeError.value || orderError.value);

watch(
  () => props.actions,
  (a) => {
    if (!a) return;
    form.greylist = a.greylist;
    form.addHeader = a.addHeader;
    form.rewriteSubject = a.rewriteSubject;
    form.reject = a.reject;
  },
  { immediate: true }
);

// Not `v-model.number`: Vue's modifier turns a cleared input into `0`
// (`Number("")`), not `null` -- which would silently mean "trigger at
// score 0" instead of "disabled", the opposite of what clearing the field
// is supposed to do. Handles both a raw string (native input) and a
// number (Nuxt UI's own numeric coercion) from `update:model-value`.
function numberField(key: keyof SaveRspamdActionsInput) {
  return computed<number | string | undefined>({
    get: () => form[key] ?? undefined,
    set: (v) => {
      if (v === undefined || v === "") {
        form[key] = null;
        return;
      }
      const n = typeof v === "number" ? v : parseFloat(v);
      form[key] = Number.isNaN(n) ? null : n;
    },
  });
}
const greylistField = numberField("greylist");
const addHeaderField = numberField("addHeader");
const rewriteSubjectField = numberField("rewriteSubject");
const rejectField = numberField("reject");

function onSave() {
  if (hasError.value) return;
  emit("save", { greylist: form.greylist, addHeader: form.addHeader, rewriteSubject: form.rewriteSubject, reject: form.reject });
}

function onReset() {
  emit("reset");
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t("rspamdPage.actions.title") }}</h2>
    </template>

    <div v-if="loading && !actions" class="space-y-3">
      <USkeleton v-for="i in 5" :key="i" class="h-9 w-full" />
    </div>
    <div v-else class="space-y-4">
      <p class="text-sm text-muted">{{ t("rspamdPage.actions.hint") }}</p>

      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm">{{ t("rspamdPage.actions.softReject") }}</label>
          <UInput :model-value="actions?.softReject ?? undefined" type="number" disabled placeholder="--" class="w-32" />
        </div>
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm">{{ t("rspamdPage.actions.greylist") }}</label>
          <UInput v-model="greylistField" type="number" min="0" :disabled="!canEdit" placeholder="--" class="w-32" />
        </div>
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm">{{ t("rspamdPage.actions.addHeader") }}</label>
          <UInput v-model="addHeaderField" type="number" min="0" :disabled="!canEdit" placeholder="--" class="w-32" />
        </div>
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm">{{ t("rspamdPage.actions.rewriteSubject") }}</label>
          <UInput v-model="rewriteSubjectField" type="number" min="0" :disabled="!canEdit" placeholder="--" class="w-32" />
        </div>
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm">{{ t("rspamdPage.actions.reject") }}</label>
          <UInput v-model="rejectField" type="number" min="0" :disabled="!canEdit" placeholder="--" class="w-32" />
        </div>
      </div>

      <UAlert
        v-if="canEdit && negativeError"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-triangle"
        :title="t('rspamdPage.actions.negativeError')"
      />
      <UAlert
        v-else-if="canEdit && orderError"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-triangle"
        :title="t('rspamdPage.actions.orderError')"
      />

      <div v-if="canEdit" class="flex items-center justify-between gap-2">
        <UButton
          icon="i-lucide-rotate-ccw"
          color="error"
          variant="soft"
          :disabled="loading"
          @click="
            () => {
              confirmResetOpen = true;
            }
          "
        >
          {{ t("rspamdPage.actions.reset") }}
        </UButton>
        <UButton :loading="loading" :disabled="hasError" @click="onSave">{{ t("rspamdPage.actions.save") }}</UButton>
      </div>
      <p v-else class="text-xs text-dimmed">{{ t("rspamdPage.actions.readOnlyHint") }}</p>
    </div>
  </UCard>

  <ConfirmModal
    v-model:open="confirmResetOpen"
    type="warning"
    :title="t('rspamdPage.actions.confirmReset')"
    :description="t('rspamdPage.actions.confirmResetDesc')"
    @confirm="onReset"
  />
</template>
