<script setup lang="ts">
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { label = "", modelValue, picked = false } = defineProps<{ label?: string; modelValue: string; picked?: boolean }>();

// The hash belongs to the field, not to what is typed in it: the digits alone
// are entered, and nothing but digits can be. Anything else is dropped as it is
// keyed, so the only invalid state left is a count that is not yet three or six,
// which is a state the field has to pass through rather than an error.
const draft = ref(modelValue.replace("#", ""));

const colour = computed({
  get: () => modelValue,
  set: (value: string) => emit("update:modelValue", value),
});

const valid = computed(() => draft.value.length === 3 || draft.value.length === 6);

watch(colour, (value) => {
  draft.value = value.replace("#", "");
});

// Applied as it is typed, the moment it means something. The short form is
// expanded, since `F00` and `FF0000` are the same colour and only one of them
// can be compared against what the theme holds.
watch(draft, (value) => {
  const digits = value
    .replace(/[^0-9a-f]/gi, "")
    .slice(0, 6)
    .toUpperCase();
  if (digits !== value) {
    draft.value = digits;
    return;
  }
  if (!valid.value) return;
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  if (`#${full}` !== colour.value) colour.value = `#${full}`;
});

// A field left half typed goes back to the colour in force rather than keeping
// a red outline nobody can act on.
function restore() {
  if (!valid.value) draft.value = colour.value.replace("#", "");
}
</script>

<template>
  <div class="min-w-0 space-y-1.5">
    <p class="truncate font-mono text-xs text-muted">{{ label }}</p>
    <UPopover>
      <!-- Marching ants rather than a border: a border would move the control
           by a pixel the moment a colour is picked, in a grid where everything
           is read by alignment. -->
      <UButton
        color="neutral"
        variant="subtle"
        :title="`${label} ${colour}`"
        :class="['w-full justify-start gap-2', picked ? 'marching-ants' : '']"
      >
        <span class="size-4 shrink-0 rounded-full ring ring-accented" :style="{ backgroundColor: colour }" />
        <span class="truncate font-mono text-xs">{{ colour }}</span>
      </UButton>

      <template #content>
        <div class="space-y-2 p-2">
          <p v-if="label" class="font-mono text-xs text-muted">{{ label }}</p>
          <UColorPicker v-model="colour" />
          <UInput
            v-model="draft"
            :color="valid ? 'neutral' : 'error'"
            size="sm"
            placeholder="RRGGBB"
            maxlength="6"
            autocomplete="off"
            spellcheck="false"
            class="w-full font-mono"
            @blur="restore"
          >
            <template #leading>
              <span class="font-mono text-xs text-dimmed">#</span>
            </template>
          </UInput>
        </div>
      </template>
    </UPopover>
  </div>
</template>
