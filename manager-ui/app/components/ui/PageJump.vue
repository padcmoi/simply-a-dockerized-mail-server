<script setup lang="ts">
// Type a page number, land on it. Beside a pager, for the collections whose pager cannot show every
// page: 1278 rows at 25 a page is 52 of them, and reaching page 40 through chevrons is 39 clicks.
//
// It writes the SAME model the pager writes, so the two are one control with two ways in: clicking
// a page number updates the field, typing one moves the pager.
//
// Debounced, because the field is typed into digit by digit. Without it, reaching for page 12 fetches
// page 1 on the way, and on a server-paged list that is a query nobody asked for.

const page = defineModel<number>("page", { required: true });

const props = withDefaults(
  defineProps<{
    // How many pages there are. The jump is clamped to it, so a number past the end lands on the
    // last page rather than on an empty table.
    pages: number;
    delay?: number;
  }>(),
  { delay: 500 }
);

const { t } = useI18n();

// `string | number`, because that is what comes back and both shapes are real: an
// <input type="number"> hands back a NUMBER once the value parses and an empty STRING while it is
// being cleared. Typing it as a string alone was a bug, not a simplification: the guard called
// `.trim()` on a number, threw inside the watcher, and every jump silently did nothing.
const draft = ref<string | number>(page.value);

// The pager is the other way in. Clicking it must move the field, or the two disagree about where
// the reader is.
watch(page, (value) => {
  draft.value = value;
});

watchDebounced(
  draft,
  (value) => {
    const typed = String(value).trim();
    const asked = Number(typed);
    if (typed.length === 0 || !Number.isInteger(asked)) return;

    const landed = Math.min(Math.max(asked, 1), Math.max(props.pages, 1));
    if (landed !== page.value) page.value = landed;
    // Corrected in the field as well, so a 999 typed into a 23 page table does not sit there
    // claiming to be where the reader is.
    if (landed !== asked) draft.value = landed;
  },
  { debounce: props.delay }
);
</script>

<template>
  <!-- Rendered whatever the page count, like the pager it stands beside. A control that appears and
       disappears with the size of the result moves everything around it, and a reader who found it
       once must find it in the same place on the next screen. On a single page it simply cannot go
       anywhere else, which is what `max` says. -->
  <!-- Bound by hand and not with `v-model`, because the two ends disagree about the type. UInput
       DECLARES a string model and, at `type="number"`, coerces what it emits through `looseToNumber`,
       so a number comes back out of a prop typed as a string. Reading it as a string and writing
       whatever arrives is what makes both ends true. -->
  <UInput
    :model-value="String(draft)"
    type="number"
    inputmode="numeric"
    :min="1"
    :max="props.pages"
    :aria-label="t('table.goToPage')"
    class="w-20"
    @update:model-value="draft = $event"
  />
</template>
