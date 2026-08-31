<script setup lang="ts">
const emit = defineEmits<{
  "update:open": [boolean];
  confirm: [];
}>();

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    description?: string;
    // "danger" is an irreversible/destructive action (delete); "warning" is a
    // disruptive-but-not-destructive one (e.g. rotating a key) -- drives the
    // button/progress-bar color and the default proceed label/hint, so a
    // non-delete action doesn't read as a deletion (see DomainDkimSection.vue).
    type?: "danger" | "warning";
    // "wait": click Proceed once, then a 10s countdown auto-confirms unless
    // canceled. "clicks": click Proceed 10 times in a row to confirm, no
    // timer at all. Defaults to "clicks" -- opt into "wait" per call-site
    // only where a countdown genuinely fits better than repeated clicking.
    confirmMode?: "wait" | "clicks";
  }>(),
  { title: undefined, description: undefined, type: "danger", confirmMode: "clicks" }
);

const DELAY = 10;
const REQUIRED_CLICKS = 10;

const phase = ref<"confirm" | "progress">("confirm");
const countdown = ref(DELAY);
const clicks = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const { t } = useI18n();

const color = computed(() => (props.type === "danger" ? "error" : "warning"));
const proceedLabel = computed(() => (props.type === "danger" ? t("confirm.proceed") : t("confirm.proceedAction")));
const countdownHint = computed(() => (props.type === "danger" ? t("confirm.countdownHint") : t("confirm.countdownHintAction")));
const clicksHint = computed(() => (props.type === "danger" ? t("confirm.clicksHint") : t("confirm.clicksHintAction")));
const progressFraction = computed(() =>
  props.confirmMode === "wait" ? countdown.value / DELAY : clicks.value / REQUIRED_CLICKS
);

watch(
  () => props.open,
  (v) => {
    if (v) {
      phase.value = "confirm";
      countdown.value = DELAY;
      clicks.value = 0;
    } else {
      clearTimer();
    }
  }
);

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startCountdown() {
  if (timer) return; // already counting down -- a stray extra click, ignore it
  phase.value = "progress";
  countdown.value = DELAY;
  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearTimer();
      emit("confirm");
      emit("update:open", false);
    }
  }, 1000);
}

// Guards against spam-clicking: `update:open(false)` doesn't remove the
// button from the DOM until the parent's `open` prop actually flips and Vue
// re-renders, which isn't instant -- a click landing in that window must be
// a no-op, not a second confirm. Checking (not just incrementing) past the
// threshold makes every click after the 10th harmless.
function registerClick() {
  if (clicks.value >= REQUIRED_CLICKS) return;
  phase.value = "progress";
  clicks.value++;
  if (clicks.value >= REQUIRED_CLICKS) {
    emit("confirm");
    emit("update:open", false);
  }
}

function proceed() {
  if (props.confirmMode === "wait") startCountdown();
  else registerClick();
}

function cancel() {
  clearTimer();
  phase.value = "confirm";
  clicks.value = 0;
  emit("update:open", false);
}

onUnmounted(clearTimer);
</script>

<template>
  <UModal :open="open" @update:open="cancel">
    <template #content>
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ title ?? t("confirm.title") }}</h3>
        </template>

        <p v-if="phase === 'confirm'" class="text-sm text-muted">
          {{ description ?? t("confirm.description") }}
        </p>

        <div v-else class="space-y-3">
          <p class="text-sm text-muted text-center">
            {{ confirmMode === "wait" ? countdownHint : clicksHint }}
          </p>
          <div class="h-2 rounded-full overflow-hidden bg-accented">
            <div
              class="h-full rounded-full transition-[width] duration-300 ease-linear"
              :class="type === 'danger' ? 'bg-error' : 'bg-warning'"
              :style="{ width: `${progressFraction * 100}%` }"
            />
          </div>
          <p class="text-center font-bold text-2xl" :class="type === 'danger' ? 'text-error' : 'text-warning'">
            {{ confirmMode === "wait" ? `${countdown}s` : `${clicks}/${REQUIRED_CLICKS}` }}
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="cancel">{{ t("common.cancel") }}</UButton>
            <UButton
              v-if="confirmMode === 'clicks' || phase === 'confirm'"
              :color="color"
              :disabled="confirmMode === 'clicks' && clicks >= REQUIRED_CLICKS"
              @click="proceed"
            >
              {{ proceedLabel }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
