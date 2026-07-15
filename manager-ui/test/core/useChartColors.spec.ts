import { describe, it, expect, vi } from "vitest";
import { reactive } from "vue";
import { useChartColors } from "~/composables/useChartColors";

describe("useChartColors", () => {
  it("returns the dark palette when the color mode is dark", () => {
    // setup.ts already stubs useColorMode to "dark"; assert the dark hues.
    vi.stubGlobal("useColorMode", () => reactive({ value: "dark" }));
    const { colors } = useChartColors();
    expect(colors.value.error).toBe("#f87171");
    expect(colors.value.warning).toBe("#fbbf24");
    expect(colors.value.success).toBe("#4ade80");
    expect(colors.value.primary).toBe("#60a5fa");
    expect(colors.value.primaryBg).toBe("rgba(96,165,250,0.35)");
    expect(colors.value.gridLine).toBe("rgba(255,255,255,0.07)");
    expect(colors.value.textMuted).toBe("#9ca3af");
  });

  it("returns the light palette when the color mode is not dark", () => {
    vi.stubGlobal("useColorMode", () => reactive({ value: "light" }));
    const { colors } = useChartColors();
    expect(colors.value.error).toBe("#ef4444");
    expect(colors.value.warning).toBe("#f59e0b");
    expect(colors.value.success).toBe("#22c55e");
    expect(colors.value.primary).toBe("#3b82f6");
    expect(colors.value.primaryBg).toBe("rgba(59,130,246,0.35)");
    expect(colors.value.gridLine).toBe("rgba(0,0,0,0.07)");
    expect(colors.value.textMuted).toBe("#6b7280");
  });

  it("recomputes reactively when the color mode flips", () => {
    const mode = reactive({ value: "dark" });
    vi.stubGlobal("useColorMode", () => mode);
    const { colors } = useChartColors();
    expect(colors.value.error).toBe("#f87171");
    mode.value = "light";
    expect(colors.value.error).toBe("#ef4444");
  });
});
