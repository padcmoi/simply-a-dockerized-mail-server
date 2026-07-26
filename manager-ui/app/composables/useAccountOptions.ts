export interface AccountOption {
  value: string;
  label: string;
}

// Typeahead over GET /accounts/names for an account picker (e.g. the domain-side
// owner field). Reads only id/email/displayName, which is what list-account-names
// exposes; the caller needs accounts:list-account-names.
export function useAccountOptions() {
  const { call } = useApi();

  const options = ref<AccountOption[]>([]);
  const searchTerm = ref("");
  const loading = ref(false);

  async function search(term = searchTerm.value) {
    loading.value = true;
    try {
      const trimmed = term.trim();
      const res = await call<{ id: string; email: string; displayName: string | null }[]>(
        `/accounts/names?limit=25${trimmed ? `&search=${encodeURIComponent(trimmed)}` : ""}`
      );
      options.value = res.map((a) => ({ value: a.id, label: a.displayName ? `${a.displayName} (${a.email})` : a.email }));
    } finally {
      loading.value = false;
    }
  }

  watch(searchTerm, (term) => void search(term));

  return { options, searchTerm, loading, search };
}
