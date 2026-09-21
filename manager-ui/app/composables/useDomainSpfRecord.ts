export function spfStateOf(record: SpfRecord) {
  if (!record.published) return "missing";
  if (record.multiple) return "multiple";
  return record.covered ? "ok" : "notCovered";
}

export function useDomainSpfRecord(domainId: () => number | null) {
  const { call } = useApi();
  return useAsyncData(
    () => `domain-spf-record-${domainId() ?? "none"}`,
    () => {
      const id = domainId();
      return id ? call<SpfRecord>(`/domains/${id}/spf-record`) : Promise.resolve(null);
    },
    { server: false, watch: [domainId] }
  );
}
