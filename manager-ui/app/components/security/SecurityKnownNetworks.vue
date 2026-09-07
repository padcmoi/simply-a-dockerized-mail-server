<script setup lang="ts">
const props = defineProps<{ accountId?: string }>();

const { t, locale } = useI18n();
const { networks, loaded, busy, keyOf, load, forget } = useKnownNetworks(() => props.accountId);

await useAsyncData(`known-networks-${props.accountId ?? "me"}`, () => load(), { server: false });

function fmt(iso: string) {
  return new Date(iso).toLocaleString(locale.value.replace(/_/g, "-"));
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t("known.networksTitle") }}</h2>
        <UBadge v-if="loaded" color="neutral" variant="subtle">{{ networks.length }}</UBadge>
      </div>
    </template>

    <div v-if="!loaded" class="space-y-3 py-1">
      <USkeleton v-for="i in 2" :key="i" class="h-12 w-full" />
    </div>

    <UEmptyState
      v-else-if="networks.length === 0"
      icon="i-lucide-network"
      :title="t('known.networksEmpty')"
      :description="t('known.networksEmptyHint')"
    />

    <ul v-else class="divide-y divide-default">
      <li v-for="n in networks" :key="keyOf(n)" class="py-3 flex items-center gap-3">
        <div class="rounded-md p-2 bg-elevated shrink-0">
          <CountryFlag :code="n.countryCode" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium truncate">{{ n.asnOrg || `AS${n.asn}` }}</p>
          <p class="text-xs text-muted truncate">
            AS{{ n.asn }} · {{ n.countryCode }}
            <template v-if="n.lastCity"> · {{ n.lastCity }}</template>
            <template v-if="n.lastIp"> · {{ n.lastIp }}</template>
          </p>
          <p class="text-xs text-dimmed truncate">
            {{ t("known.seenCount", { count: n.loginCount }) }} · {{ t("known.lastSeen") }} {{ fmt(n.lastSeenAt) }} ·
            {{ t("known.networkKeptUntil", { date: fmt(n.expiresAt) }) }}
          </p>
          <ul v-if="n.addresses.length" class="mt-1 space-y-0.5">
            <li v-for="a in n.addresses" :key="a.ip" class="text-xs text-muted truncate">
              <span class="font-mono">{{ a.ip }}</span>
              <template v-if="a.city"> · {{ a.city }}</template>
              · {{ t("known.seenCount", { count: a.loginCount }) }} ·
              {{ t("known.addressKeptUntil", { date: fmt(a.expiresAt) }) }}
            </li>
          </ul>
          <p v-else class="mt-1 text-xs text-dimmed">{{ t("known.addressesNone") }}</p>
        </div>
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          :loading="busy === keyOf(n)"
          :title="t('known.forgetNetwork')"
          @click="forget(n)"
        />
      </li>
    </ul>

    <template #footer>
      <p class="text-sm text-muted">{{ t("known.networksFooter") }}</p>
    </template>
  </UCard>
</template>
