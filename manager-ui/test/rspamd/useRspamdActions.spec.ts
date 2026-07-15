import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useRspamdActions } from "~/composables/useRspamdActions";

// This composable is a thin useAsyncData wrapper; its own logic is the
// actions/actionsLoading computeds and the PATCH/DELETE + refresh in
// save/reset. Drive useAsyncData with controllable refs to observe them.
const data = ref<unknown>(null);
const status = ref("idle");
const refresh = vi.fn();
let call: ReturnType<typeof vi.fn>;

beforeEach(() => {
  data.value = null;
  status.value = "idle";
  refresh.mockClear();
  call = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useDataRefresh", () => ({ tick: ref(0), bump: vi.fn() }));
  vi.stubGlobal("useAsyncData", () => ({
    data,
    status,
    pending: ref(false),
    error: ref(null),
    refresh,
    execute: vi.fn(),
  }));
});

describe("useRspamdActions state", () => {
  it("exposes the async data as `actions`", () => {
    const thresholds = { reject: 15, softReject: null, rewriteSubject: 10, addHeader: 6, greylist: 4 };
    data.value = thresholds;
    const { actions } = useRspamdActions();
    expect(actions.value).toEqual(thresholds);
  });

  it("reports loading only while the fetch is pending", () => {
    const { actionsLoading } = useRspamdActions();
    expect(actionsLoading.value).toBe(false);
    status.value = "pending";
    expect(actionsLoading.value).toBe(true);
    status.value = "success";
    expect(actionsLoading.value).toBe(false);
  });
});

describe("useRspamdActions.saveActions", () => {
  it("PATCHes the thresholds then refreshes", async () => {
    const { saveActions } = useRspamdActions();
    const input = { reject: 15, rewriteSubject: 10, addHeader: 6, greylist: 4 };
    await saveActions(input);
    expect(call).toHaveBeenCalledWith("/rspamd/actions", { method: "PATCH", body: input });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("useRspamdActions.resetActions", () => {
  it("DELETEs the overrides then refreshes", async () => {
    const { resetActions } = useRspamdActions();
    await resetActions();
    expect(call).toHaveBeenCalledWith("/rspamd/actions", { method: "DELETE" });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
