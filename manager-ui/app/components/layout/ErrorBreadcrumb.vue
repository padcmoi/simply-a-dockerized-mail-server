<script setup lang="ts">
// Rendered inside the layout's BreadcrumbProvider (error.vue wraps its content
// in NuxtLayout), so it can feed the same breadcrumb bar the normal pages use.
// It draws nothing itself: it only derives the current section from the nav so
// an error page keeps a way back, rather than stranding the user with no trail.
const route = useRoute();
// error.vue mounts this under the errored route's own layout; the auth layout
// (login and other pre-auth pages) has no BreadcrumbProvider, so use the
// non-throwing variant and simply feed nothing when the provider is absent.
const breadcrumb = useBreadcrumbOptional();
const { personalNavItems, adminNavItems } = useNav(async () => {});

const section = computed(() => navSectionFor(route.path, [...adminNavItems.value, ...personalNavItems.value]));

watchEffect(() => breadcrumb?.set(section.value ? [section.value] : []));
</script>

<template>
  <span class="hidden" />
</template>
