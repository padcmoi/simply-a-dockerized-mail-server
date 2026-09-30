import { StorageSerializers } from "@vueuse/core";
import { LIST_LIMIT_STORAGE_KEY } from "./usePaginatedList";

export const TABLE_PAGE_SIZE_PREFIX = "manager-table-page-size:";

export function useTablePageSize(tableId: string) {
  const fallback = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
  const own = useLocalStorage<number | null>(`${TABLE_PAGE_SIZE_PREFIX}${tableId}`, null, {
    serializer: StorageSerializers.object,
  });
  return computed<number>({
    get: () => (typeof own.value === "number" && own.value > 0 ? own.value : fallback.value),
    set: (value) => {
      own.value = value;
    },
  });
}
