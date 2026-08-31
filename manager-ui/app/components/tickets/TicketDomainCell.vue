<script setup lang="ts">
// The Domain cell of the ticket list: the domain, and how many addresses the
// ticket names. The whole cell is the button, so the affordance is on the thing
// one reads rather than on a badge beside it, and it always opens: a ticket
// naming nothing says so rather than leaving the reader to guess what a 0 hides.
const props = defineProps<{
  domainName: string | null;
  recipients: TicketRecipientRef[];
  aliases: TicketAliasRef[];
}>();

const { t } = useI18n();

const total = computed(() => props.recipients.length + props.aliases.length);
</script>

<template>
  <!-- Click and not hover: a hover card never opens on a touch screen, and the
       list is read on a phone as much as on a desk. -->
  <UPopover :content="{ side: 'bottom', align: 'start' }">
    <UButton color="neutral" variant="ghost" size="xs" class="max-w-full" :title="t('tickets.table.namedResources')">
      <span class="truncate">{{ domainName ?? "-" }}</span>
      <UBadge :color="total ? 'primary' : 'neutral'" variant="subtle" class="tabular-nums">{{ total }}</UBadge>
    </UButton>

    <template #content>
      <div class="p-3 space-y-3 text-sm max-w-80">
        <p v-if="!total" class="text-xs text-muted">{{ t("tickets.table.namesNothing") }}</p>

        <!-- Both kinds are always named, the empty one included: reading only
             "Aliases" would leave it unsaid whether a mailbox was named at all. -->
        <template v-else>
          <div class="space-y-1">
            <p class="text-xs text-muted">{{ t("tickets.form.recipients") }}</p>
            <p v-if="!recipients.length" class="text-xs text-dimmed">{{ t("tickets.table.noRecipientNamed") }}</p>
            <p v-for="recipient in recipients" :key="recipient.id" class="font-mono text-xs break-all">
              {{ recipient.email }}
            </p>
          </div>

          <div class="space-y-1">
            <p class="text-xs text-muted">{{ t("tickets.form.aliases") }}</p>
            <p v-if="!aliases.length" class="text-xs text-dimmed">{{ t("tickets.table.noAliasNamed") }}</p>
            <p v-for="alias in aliases" :key="alias.id" class="font-mono text-xs break-all">
              {{ alias.source }} <span class="text-dimmed">-&gt; {{ alias.destination }}</span>
            </p>
          </div>
        </template>
      </div>
    </template>
  </UPopover>
</template>
