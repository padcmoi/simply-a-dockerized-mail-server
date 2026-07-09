import type { GroupDetail } from "./useGroups";

// Shared loader for every /groups/:id/* sub-page (info, owner, members,
// application, domain) -- each page pulls whichever GroupDetail fields it
// needs and sets its own last breadcrumb crumb; this composable only owns
// the fetch + auto-refresh, mirroring useDomainDashboard's role for domains.
export function useGroupDetail(groupId: Ref<number>) {
  const { getDetail } = useGroups();

  const {
    data: group,
    status,
    refresh,
  } = useAsyncData<GroupDetail | null>(
    () => `group-detail-${groupId.value}`,
    () => getDetail(groupId.value),
    { server: false, watch: [groupId], default: () => null }
  );
  const loading = computed(() => status.value !== "success" && status.value !== "error");

  watch(useDataRefresh().tick, () => refresh());

  return { group, loading, refresh };
}
