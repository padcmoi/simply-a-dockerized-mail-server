import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { usePresence } from "~/composables/usePresence";

let pushed: ReturnType<typeof ref<string[] | null>>;

beforeEach(() => {
  pushed = ref(null);
  vi.stubGlobal("useRealtimeTopic", () => computed(() => pushed.value));
});

describe("usePresence", () => {
  it("reports an account carried by the presence list as online", () => {
    pushed.value = ["a", "b"];
    expect(usePresence().isOnline("a")).toBe(true);
  });

  it("reports an account absent from the list as offline", () => {
    pushed.value = ["a"];
    expect(usePresence().isOnline("z")).toBe(false);
  });

  it("treats everyone as offline before the first push", () => {
    expect(usePresence().isOnline("a")).toBe(false);
  });

  it("never marks a missing id online", () => {
    pushed.value = ["a"];
    expect(usePresence().isOnline(null)).toBe(false);
    expect(usePresence().isOnline(undefined)).toBe(false);
  });
});
