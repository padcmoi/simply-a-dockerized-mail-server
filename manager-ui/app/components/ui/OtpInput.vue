<script setup lang="ts">
// A one-time code, one digit per cell, on Nuxt UI's PinInput: the caret moves
// on as digits are typed, backspace steps back into the previous cell, a paste
// fills the row and a phone brings up its numeric keyboard. No button: the
// moment the last cell is filled `complete` fires with the code, and whoever
// checked it answers a refusal with `reject()`, which shakes the row, empties
// every cell and puts the caret back on the first one.
const emit = defineEmits<{ complete: [code: string] }>();
const model = defineModel<string>({ default: "" });
const props = withDefaults(defineProps<{ length?: number; disabled?: boolean; autofocus?: boolean }>(), {
  length: 6,
  disabled: false,
  autofocus: false,
});

// Digits, since the cells are numeric: what leaves this component is the string.
const cells = ref<number[]>([]);
const rejected = ref(false);
const pin = useTemplateRef<{ inputsRef: { $el?: HTMLElement }[] }>("pin");

watch(
  cells,
  (next) => {
    model.value = next.join("");
  },
  { deep: true }
);

// The caller may clear or set the code from outside; the cells follow.
watch(model, (next) => {
  if (next !== cells.value.join("")) cells.value = next.split("").slice(0, props.length).map(Number);
});

function onComplete(value: number[]) {
  emit("complete", value.join(""));
}

function focus() {
  pin.value?.inputsRef[0]?.$el?.focus();
}

function clear() {
  cells.value = [];
}

async function reject() {
  rejected.value = true;
  clear();
  await nextTick();
  focus();
  setTimeout(() => {
    rejected.value = false;
  }, 500);
}

defineExpose({ reject, clear, focus });
</script>

<template>
  <UPinInput
    ref="pin"
    v-model="cells"
    :length="length"
    type="number"
    otp
    placeholder="○"
    size="xl"
    :color="rejected ? 'error' : undefined"
    :highlight="rejected"
    :disabled="disabled"
    :autofocus="autofocus"
    :class="rejected && 'otp-rejected'"
    @complete="onComplete"
  />
</template>

<style scoped>
@keyframes otp-shake {
  10%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  80% {
    transform: translateX(3px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-5px);
  }
  40%,
  60% {
    transform: translateX(5px);
  }
}

.otp-rejected {
  animation: otp-shake 0.5s;
}
</style>
