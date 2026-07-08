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
    // button/progress-bar color and the default proceed label/countdown hint,
    // so a non-delete action doesn't read as a deletion (see DomainDkimSection.vue).
    type?: "danger" | "warning";
  }>(),
  { title: undefined, description: undefined, type: "danger" }
);

const DELAY = 10;

const phase = ref<"confirm" | "countdown">("confirm");
const countdown = ref(DELAY);
let timer: ReturnType<typeof setInterval> | null = null;

const { t } = useI18n();

const color = computed(() => (props.type === "danger" ? "error" : "warning"));
const proceedLabel = computed(() => (props.type === "danger" ? t("confirm.proceed") : t("confirm.proceedAction")));
const countdownHint = computed(() => (props.type === "danger" ? t("confirm.countdownHint") : t("confirm.countdownHintAction")));

watch(
  () => props.open,
  (v) => {
    if (v) {
      phase.value = "confirm";
      countdown.value = DELAY;
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
  phase.value = "countdown";
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

function cancel() {
  clearTimer();
  phase.value = "confirm";
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
            {{ countdownHint }}
          </p>
          <div class="h-2 rounded-full overflow-hidden bg-accented">
            <div
              class="h-full rounded-full transition-[width] duration-1000 ease-linear"
              :class="type === 'danger' ? 'bg-error' : 'bg-warning'"
              :style="{ width: `${(countdown / DELAY) * 100}%` }"
            />
          </div>
          <p class="text-center font-bold text-2xl" :class="type === 'danger' ? 'text-error' : 'text-warning'">
            {{ countdown }}s
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="cancel">{{ t("common.cancel") }}</UButton>
            <UButton v-if="phase === 'confirm'" :color="color" @click="startCountdown">
              {{ proceedLabel }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
