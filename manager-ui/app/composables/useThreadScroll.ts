// Keeping a conversation's scroll where the reader is: stuck to the end while
// they are reading the end, held on the same message while an older page is
// inserted above it. The component owns nothing of this but the element.

const AT_BOTTOM_PX = 80;

export function useThreadScroll(options: {
  firstId: () => number | undefined;
  lastId: () => number | undefined;
  loadingOlder: () => boolean;
  onLoadOlder: () => void;
}) {
  const scroller = useTemplateRef<HTMLElement>("scroller");
  const stickToBottom = ref(true);
  // Height captured the instant an older page is asked for, so the scroll can be
  // put back on the same message once that page has actually rendered.
  const anchorHeight = ref<number | null>(null);

  // Prepending shifts the whole thread down under the reader, which would also
  // leave the view at the top and pull the next page straight away. Growing the
  // scroll by exactly what was inserted keeps the same message under the eye.
  watch(options.firstId, async (first, previous) => {
    const el = scroller.value;
    const before = anchorHeight.value;
    anchorHeight.value = null;
    if (!el || before === null || previous === undefined || first === previous) return;
    await nextTick();
    el.scrollTop += el.scrollHeight - before;
  });

  // A request that brings nothing back would otherwise leave a stale anchor,
  // which the next incoming message would then wrongly apply.
  watch(options.loadingOlder, (loading) => {
    if (!loading) anchorHeight.value = null;
  });

  // Follow the conversation only when already reading its end: pulling an older
  // page or scrolling up must not yank the view back down.
  watch(
    options.lastId,
    async () => {
      if (!stickToBottom.value) return;
      await nextTick();
      const el = scroller.value;
      if (el) el.scrollTop = el.scrollHeight;
    },
    { immediate: true }
  );

  function onScroll() {
    const el = scroller.value;
    if (!el) return;
    stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_PX;
  }

  // The load is asynchronous, so the height is only recorded here; the watcher
  // above re-anchors once the older page has actually rendered.
  function requestOlder() {
    anchorHeight.value = scroller.value?.scrollHeight ?? null;
    options.onLoadOlder();
  }

  return { scroller, onScroll, requestOlder };
}
