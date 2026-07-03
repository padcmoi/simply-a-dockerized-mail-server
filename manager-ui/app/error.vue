<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();

const is403 = computed(() => props.error.statusCode === 403);
const is404 = computed(() => props.error.statusCode === 404);

function goHome() {
  clearError({ redirect: "/dashboard" });
}

function goBack() {
  clearError();
  history.back();
}
</script>

<template>
  <NuxtLayout>
    <div class="flex flex-1 items-center justify-center min-h-[60vh] px-4">
      <div class="text-center space-y-6 max-w-sm">
        <div class="flex justify-center">
          <div class="size-20 rounded-full flex items-center justify-center" :class="is403 ? 'bg-error/10' : 'bg-muted/10'">
            <UIcon
              :name="is403 ? 'i-lucide-shield-x' : is404 ? 'i-lucide-file-question' : 'i-lucide-triangle-alert'"
              class="size-10"
              :class="is403 ? 'text-error' : 'text-muted'"
            />
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-6xl font-bold" :class="is403 ? 'text-error' : 'text-muted'">{{ error.statusCode }}</p>
          <h1 class="text-xl font-semibold">
            {{ is403 ? t("error.403.title") : is404 ? t("error.404.title") : t("error.generic.title") }}
          </h1>
          <p class="text-sm text-muted">
            {{ is403 ? t("error.403.description") : is404 ? t("error.404.description") : t("error.generic.description") }}
          </p>
        </div>

        <div class="flex flex-col sm:flex-row gap-2 justify-center">
          <UButton color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="goBack">
            {{ t("common.back") }}
          </UButton>
          <UButton color="primary" icon="i-lucide-layout-dashboard" @click="goHome">
            {{ t("nav.dashboard") }}
          </UButton>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>
