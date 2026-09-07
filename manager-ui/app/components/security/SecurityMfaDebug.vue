<script setup lang="ts">
defineProps<{ debug: MfaDebug }>();

const { t } = useI18n();

function place(city: string, latitude: number, longitude: number, countryCode = "") {
  const name = [city || "?", countryCode].filter(Boolean).join(", ");
  return `${name} (${latitude}, ${longitude})`;
}
</script>

<template>
  <div class="mt-3 rounded-md bg-elevated p-3 text-left text-xs font-mono text-muted space-y-1">
    <p class="font-semibold text-warning">{{ t("login.mfaDebugTitle") }}</p>
    <p>
      {{ t("login.mfaDebugDistance") }}:
      {{ debug.distanceKm === null ? t("login.mfaDebugUnknown") : `${debug.distanceKm} km` }}
      ({{ t("login.mfaDebugThreshold") }} {{ debug.thresholdKm }} km)
    </p>
    <p>
      {{ t("login.mfaDebugFrom") }}:
      <template v-if="debug.from">
        {{ debug.from.kind === "address" ? t("login.mfaDebugFromAddress") : t("login.mfaDebugFromNearest") }},
        {{ debug.from.ip }}, {{ place(debug.from.city, debug.from.latitude, debug.from.longitude) }}
      </template>
      <template v-else>{{ t("login.mfaDebugUnknown") }}</template>
    </p>
    <p>
      {{ t("login.mfaDebugTo") }}:
      {{
        debug.to ? place(debug.to.city, debug.to.latitude, debug.to.longitude, debug.to.countryCode) : t("login.mfaDebugUnknown")
      }}
    </p>
    <p v-if="debug.to">{{ t("login.mfaDebugOperator") }}: AS{{ debug.to.asn ?? "?" }} {{ debug.to.asnOrg }}</p>
    <p>{{ t("login.mfaDebugReasons") }}: {{ debug.reasons.join(" + ") }}</p>
  </div>
</template>
