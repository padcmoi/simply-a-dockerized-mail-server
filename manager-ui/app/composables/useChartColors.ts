export function useChartColors() {
  const colorMode = useColorMode();

  const colors = computed(() => {
    const dark = colorMode.value === "dark";
    return {
      error: dark ? "#f87171" : "#ef4444",
      warning: dark ? "#fbbf24" : "#f59e0b",
      success: dark ? "#4ade80" : "#22c55e",
      primary: dark ? "#60a5fa" : "#3b82f6",
      primaryBg: dark ? "rgba(96,165,250,0.35)" : "rgba(59,130,246,0.35)",
      textMuted: dark ? "#9ca3af" : "#6b7280",
      gridLine: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
    };
  });

  return { colors };
}
