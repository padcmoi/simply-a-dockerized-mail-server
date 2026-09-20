<script setup lang="ts">
// The bar above every page. It carries the breadcrumb itself, and no title of
// its own: the trail already names the page and the section it belongs to, and
// a title beside it only said the same word twice.
const { toggle } = useSidebar();
const { t } = useI18n();
const { items } = useBreadcrumb();
const { y } = useWindowScroll();

const hidden = useHeadroom();

watch(y, (now, before) => {
  if (now <= 0 || atBottom(now)) hidden.value = false;
  else if (Math.abs(now - before) > 4) hidden.value = now > before;
});

function atBottom(now: number) {
  return document.documentElement.scrollHeight - globalThis.innerHeight - now <= 2;
}
</script>

<template>
  <div
    class="sticky top-0 z-40 h-(--ui-header-height) shrink-0 flex items-center gap-2 px-4 border-b border-default bg-default transition-transform duration-200"
    :class="hidden && '-translate-y-full'"
  >
    <UButton icon="i-lucide-panel-left" color="neutral" variant="ghost" :aria-label="t('layout.toggleSidebar')" @click="toggle" />
    <USeparator orientation="vertical" class="h-5" />
    <UBreadcrumb v-if="items.length" :items="items" class="min-w-0 overflow-hidden">
      <template #item-label="{ item }">
        <TruncatedText :text="String(item.label ?? '')" :limit="26" />
      </template>
    </UBreadcrumb>
    <div class="ml-auto shrink-0 flex items-center gap-1">
      <HeaderRefreshButton />
      <HeaderNotificationsButton />
    </div>
  </div>
</template>
