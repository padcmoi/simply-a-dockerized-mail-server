<script setup lang="ts">
// The otpauth URI as a square to scan, drawn from the in-house encoder in
// utils/qrcode.ts. Black on white whatever the theme: a scanner reads contrast,
// and a dark-mode inversion is exactly what some of them refuse.
const props = defineProps<{ value: string }>();

const modules = computed(() => qrModules(props.value));
const path = computed(() => qrSvgPath(modules.value));
const side = computed(() => modules.value.length + 8);
</script>

<template>
  <svg
    :viewBox="`-4 -4 ${side} ${side}`"
    class="size-48 rounded-lg bg-white shrink-0"
    shape-rendering="crispEdges"
    role="img"
    aria-label="QR code"
  >
    <path :d="path" fill="#000" />
  </svg>
</template>
