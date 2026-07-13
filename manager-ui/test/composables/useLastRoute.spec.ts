import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { useLastRoute } from "~/composables/useLastRoute";

// useLocalStorage is stubbed in setup.ts as (_k, init) => ref(init); each test
// re-stubs it so it starts from a known value and can be inspected/mutated.
function stubStorage(initial: string) {
  const store = ref(initial);
  vi.stubGlobal("useLocalStorage", () => store);
  return store;
}

describe("useLastRoute.remember", () => {
  it("stores a protected route", () => {
    const store = stubStorage("/dashboard");
    const { remember } = useLastRoute();
    remember("/domains");
    expect(store.value).toBe("/domains");
  });

  it("never stores a login route, in any shape", () => {
    const store = stubStorage("/domains");
    const { remember } = useLastRoute();
    remember("/login");
    remember("/login?redirect=/x");
    remember("/login/callback");
    expect(store.value).toBe("/domains");
  });

  it("ignores an empty path", () => {
    const store = stubStorage("/domains");
    const { remember } = useLastRoute();
    remember("");
    expect(store.value).toBe("/domains");
  });
});

describe("useLastRoute.resolve", () => {
  it("returns the stored protected route", () => {
    stubStorage("/domains/foo/recipients");
    const { resolve } = useLastRoute();
    expect(resolve()).toBe("/domains/foo/recipients");
  });

  it("falls back to the dashboard for a login or empty stored value", () => {
    const store = stubStorage("/dashboard");
    const { resolve } = useLastRoute();

    store.value = "/login";
    expect(resolve()).toBe("/dashboard");
    store.value = "/login/callback";
    expect(resolve()).toBe("/dashboard");
    store.value = "";
    expect(resolve()).toBe("/dashboard");
  });

  it("defaults to the dashboard before anything is remembered", () => {
    stubStorage("/dashboard");
    const { resolve, lastRoute } = useLastRoute();
    expect(lastRoute.value).toBe("/dashboard");
    expect(resolve()).toBe("/dashboard");
  });
});
