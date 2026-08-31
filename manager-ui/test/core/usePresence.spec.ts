import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { usePresence } from "~/composables/usePresence";

let pushed: ReturnType<typeof ref<unknown>>;

beforeEach(() => {
  pushed = ref(null);
  vi.stubGlobal("useRealtimeTopic", () => computed(() => pushed.value));
});

describe("usePresence", () => {
  it("reports an account carried by the presence list as online", () => {
    pushed.value = { online: ["a", "b"], lastSeen: {} };
    expect(usePresence().isOnline("a")).toBe(true);
  });

  it("reports an account absent from the list as offline", () => {
    pushed.value = { online: ["a"], lastSeen: {} };
    expect(usePresence().isOnline("z")).toBe(false);
  });

  it("treats everyone as offline before the first push", () => {
    expect(usePresence().isOnline("a")).toBe(false);
  });

  it("never marks a missing id online", () => {
    pushed.value = { online: ["a"], lastSeen: {} };
    expect(usePresence().isOnline(null)).toBe(false);
    expect(usePresence().isOnline(undefined)).toBe(false);
  });

  it("reports when an offline account was last seen", () => {
    pushed.value = { online: [], lastSeen: { b: "2026-07-23T08:00:00.000Z" } };
    expect(usePresence().lastSeenAt("b")).toBe("2026-07-23T08:00:00.000Z");
  });

  it("reports nothing for an account that was never seen", () => {
    pushed.value = { online: ["a"], lastSeen: {} };
    expect(usePresence().lastSeenAt("a")).toBeNull();
    expect(usePresence().lastSeenAt(null)).toBeNull();
  });
});
