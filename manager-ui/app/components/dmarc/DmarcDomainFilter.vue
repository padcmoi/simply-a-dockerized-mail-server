<script setup lang="ts">
const domain = defineModel<string>({ default: "" });
const props = defineProps<{ domains: string[] }>();

const { t } = useI18n();

const ALL = "__all__";
const items = computed(() => [
  { label: t("dmarc.allDomains"), value: ALL },
  ...[...new Set([...props.domains, ...(domain.value ? [domain.value] : [])])].sort().map((value) => ({ label: value, value })),
]);
const selected = computed({
  get: () => domain.value || ALL,
  set: (value: string) => {
    domain.value = value === ALL ? "" : value;
  },
});
</script>

<template>
  <USelect v-model="selected" :items="items" icon="i-lucide-globe" class="w-full @lg:w-64" />
</template>
