export const useDomainStore = defineStore(
  "domain",
  () => {
    const selected = ref<DomainInfo | null>(null);
    function select(d: DomainInfo) {
      selected.value = d;
    }
    function clear() {
      selected.value = null;
    }
    return { selected, select, clear };
  },
  { persist: true }
);
