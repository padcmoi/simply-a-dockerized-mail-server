<template>
  <UMain class="flex flex-1 min-h-dvh">
    <AppNavigation />

    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader />

      <BreadcrumbProvider>
        <slot />
      </BreadcrumbProvider>
    </div>
  </UMain>
</template>
