const MB = 1024 * 1024;

export interface RecipientHeadroom {
  domainQuota: number;
  allocated: number;
  available: number;
}

// What the domain has left to grant its recipients, read from the API rather
// than summed client-side: the recipients list is paginated, so the browser
// never holds every recipient of the domain at once.
//
// Shared by the list page (which needs it to cap the edit modal) and the
// create page (which needs it to cap the new quota), and reloaded on every
// mutation of either, since each one shifts what is left.
export function useRecipientHeadroom(domainId: Readonly<Ref<number | null>>) {
  const { call } = useApi();

  const headroom = ref<RecipientHeadroom | null>(null);

  // `available` is negative on a domain whose recipients were overcommitted
  // before the rule existed, hence the clamp: no quota can be granted there
  // until some is freed.
  const availableMb = computed(() => (headroom.value ? Math.max(0, Math.floor(headroom.value.available / MB)) : 0));

  async function loadHeadroom() {
    if (!domainId.value) return;
    headroom.value = await call<RecipientHeadroom>(`/domains/${domainId.value}/recipients/headroom`).catch(() => null);
  }

  // `domainId` starts null on a hard reload and only resolves once
  // useCurrentDomain has matched the slug, so this must watch rather than
  // fire once on mount.
  watch(domainId, loadHeadroom, { immediate: true });

  return { headroom, availableMb, loadHeadroom };
}
