import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { useRecipientHeadroom } from "~/composables/useRecipientHeadroom";

const MB = 1024 * 1024;
const flush = () => new Promise((resolve) => setTimeout(resolve));

// useApi is a Nuxt auto-import, not stubbed by setup.ts; each test provides the
// `call` it wants before mounting the composable.
function stubApi(call: (path: string) => Promise<unknown>) {
  const spy = vi.fn(call);
  vi.stubGlobal("useApi", () => ({ call: spy }));
  return spy;
}

describe("useRecipientHeadroom.availableMb", () => {
  it("is zero while no headroom has loaded", () => {
    stubApi(async () => null);
    const { availableMb, headroom } = useRecipientHeadroom(ref(null));
    expect(headroom.value).toBeNull();
    expect(availableMb.value).toBe(0);
  });

  it("floors the available bytes down to whole megabytes", () => {
    stubApi(async () => null);
    const { availableMb, headroom } = useRecipientHeadroom(ref(null));
    headroom.value = { domainQuota: 100 * MB, allocated: 40 * MB, available: 10 * MB + 12_345 };
    expect(availableMb.value).toBe(10);
  });

  it("clamps a negative (overcommitted) available to zero", () => {
    stubApi(async () => null);
    const { availableMb, headroom } = useRecipientHeadroom(ref(null));
    headroom.value = { domainQuota: 100 * MB, allocated: 120 * MB, available: -5 * MB };
    expect(availableMb.value).toBe(0);
  });
});

describe("useRecipientHeadroom.loadHeadroom", () => {
  it("fetches the domain's headroom for a truthy domain id", async () => {
    const payload = { domainQuota: 100 * MB, allocated: 30 * MB, available: 7 * MB };
    const call = stubApi(async () => payload);
    const { headroom, availableMb } = useRecipientHeadroom(ref(5));
    await flush();
    expect(call).toHaveBeenCalledWith("/domains/5/recipients/headroom");
    expect(headroom.value).toEqual(payload);
    expect(availableMb.value).toBe(7);
  });

  it("swallows a failed fetch and leaves headroom null", async () => {
    stubApi(async () => {
      throw new Error("500");
    });
    const { headroom, availableMb } = useRecipientHeadroom(ref(9));
    await flush();
    expect(headroom.value).toBeNull();
    expect(availableMb.value).toBe(0);
  });

  it("does not fetch while the domain id is still null", async () => {
    const call = stubApi(async () => ({}));
    useRecipientHeadroom(ref(null));
    await flush();
    expect(call).not.toHaveBeenCalled();
  });

  it("reloads when the domain id resolves from null", async () => {
    const payload = { domainQuota: 50 * MB, allocated: 0, available: 50 * MB };
    const call = stubApi(async () => payload);
    const domainId = ref<number | null>(null);
    const { headroom } = useRecipientHeadroom(domainId);
    await flush();
    expect(call).not.toHaveBeenCalled();

    domainId.value = 3;
    await nextTick();
    await flush();
    expect(call).toHaveBeenCalledWith("/domains/3/recipients/headroom");
    expect(headroom.value).toEqual(payload);
  });
});
