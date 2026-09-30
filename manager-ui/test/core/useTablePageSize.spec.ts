import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, type Ref } from "vue";
import { LIST_LIMIT_STORAGE_KEY } from "~/composables/usePaginatedList";
import { TABLE_PAGE_SIZE_PREFIX, useTablePageSize } from "~/composables/useTablePageSize";

let store: Map<string, Ref<unknown>>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("useLocalStorage", (key: string, init: unknown) => {
    if (!store.has(key)) store.set(key, ref(init));
    return store.get(key);
  });
});

describe("useTablePageSize", () => {
  it("follows the default page size of the preferences while the table has none of its own", () => {
    const size = useTablePageSize("accounts-list");
    expect(size.value).toBe(10);
    store.get(LIST_LIMIT_STORAGE_KEY)!.value = 25;
    expect(size.value).toBe(25);
  });

  it("keeps a choice under the table's own key, leaving the default and the other tables alone", () => {
    const accounts = useTablePageSize("accounts-list");
    const domains = useTablePageSize("domains-list");
    accounts.value = 50;
    expect(store.get(`${TABLE_PAGE_SIZE_PREFIX}accounts-list`)!.value).toBe(50);
    expect(store.get(LIST_LIMIT_STORAGE_KEY)!.value).toBe(10);
    expect(accounts.value).toBe(50);
    expect(domains.value).toBe(10);
  });

  it("gives the same value to two uses of the same table", () => {
    useTablePageSize("postfix-queue-messages").value = 100;
    expect(useTablePageSize("postfix-queue-messages").value).toBe(100);
  });

  it("falls back to the default when the stored value is not a usable size", () => {
    store.set(`${TABLE_PAGE_SIZE_PREFIX}broken`, ref("abc"));
    expect(useTablePageSize("broken").value).toBe(10);
    store.set(`${TABLE_PAGE_SIZE_PREFIX}zero`, ref(0));
    expect(useTablePageSize("zero").value).toBe(10);
  });
});
