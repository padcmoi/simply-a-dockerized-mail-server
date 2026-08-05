import { describe, it, expect, vi, beforeEach } from "vitest";
import { effectScope, ref } from "vue";
import * as themeUtils from "~/utils/theme";
import type { ThemeView } from "~/utils/theme";

// The composable reads its helpers through Nuxt's auto-imports, which this suite
// deliberately does not boot: the real ones are handed over as globals.
for (const [name, value] of Object.entries(themeUtils)) vi.stubGlobal(name, value);

let call: ReturnType<typeof vi.fn>;
const app = ref<ThemeView>({ light: {}, dark: {} });
const account = ref<ThemeView>({ light: {}, dark: {} });

// The two themes are shared state in the app, and the point of these tests is
// what is left in them once the bench is gone.
vi.stubGlobal("useState", (key: string, init?: () => unknown) => {
  if (key === "theme-app") return app;
  if (key === "theme-account") return account;
  return ref(init ? init() : undefined);
});

beforeEach(() => {
  app.value = { light: {}, dark: {} };
  account.value = { light: {}, dark: {} };
  call = vi.fn().mockResolvedValue({ light: { primary: "#00C950" }, dark: { primary: "#00C950" } });
  vi.stubGlobal("useApi", () => ({ call }));
  vi.stubGlobal("useApiError", () => ({ apiErrorMessage: (error: unknown) => String(error) }));
});

const { useThemeColors } = await import("~/composables/useThemeColors");

// The colour mode stub reports dark, so every pick below lands in the dark half.
function bench(scope: "app" | "account" = "app") {
  const owner = effectScope();
  const colors = owner.run(() => useThemeColors(scope))!;
  return { ...colors, leave: () => owner.stop() };
}

describe("useThemeColors", () => {
  // A pick is a proposal until it is saved. Leaving the bench with one in hand
  // would otherwise paint every other page of the session with a colour nobody
  // kept, since the theme is shared state.
  it("puts the stored theme back when the bench is left unsaved", async () => {
    const colors = bench();
    await colors.load();

    colors.setValue("primary", "#FF0000");
    expect(app.value.dark.primary).toBe("#FF0000");

    colors.leave();
    expect(app.value).toEqual({ light: { primary: "#00C950" }, dark: { primary: "#00C950" } });
  });

  it("puts back what the database holds, not what the interface ships with", async () => {
    const colors = bench();
    await colors.load();

    colors.reset();
    expect(app.value.dark).toEqual({});

    colors.leave();
    expect(app.value.dark).toEqual({ primary: "#00C950" });
  });

  it("keeps a saved theme when the bench is left", async () => {
    const colors = bench();
    await colors.load();

    colors.setValue("primary", "#FF0000");
    await colors.save();
    expect(call).toHaveBeenLastCalledWith("/config/theme", expect.objectContaining({ method: "PUT" }));

    colors.leave();
    expect(app.value.dark.primary).toBe("#FF0000");
  });

  // A save the API refused leaves an unsaved bench, which is what it is.
  it("puts the theme back when the save was refused", async () => {
    const colors = bench();
    await colors.load();

    colors.setValue("primary", "#FF0000");
    call.mockRejectedValueOnce(new Error("nope"));
    await colors.save();

    colors.leave();
    expect(app.value.dark.primary).toBe("#00C950");
  });

  // The page around the bench holds this composable too, only to read the theme.
  it("puts nothing back from an instance that changed nothing", async () => {
    const colors = bench();
    await colors.load();
    colors.setValue("primary", "#FF0000");

    const page = bench();
    page.leave();
    expect(app.value.dark.primary).toBe("#FF0000");

    colors.leave();
    expect(app.value.dark.primary).toBe("#00C950");
  });

  it("holds the two scopes apart, an account leaving the server's theme alone", async () => {
    const own = bench("account");
    await own.load();
    expect(call).toHaveBeenCalledWith("/my-space/theme");

    app.value = { light: {}, dark: { primary: "#00C950" } };
    own.setValue("primary", "#FF0000");
    own.leave();

    expect(account.value.dark.primary).toBe("#00C950");
    expect(app.value.dark.primary).toBe("#00C950");
  });
});
