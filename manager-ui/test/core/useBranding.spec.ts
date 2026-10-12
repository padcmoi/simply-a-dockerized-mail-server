import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import defaultIcon from "~/assets/favicon.svg";
import defaultLogo from "~/assets/naskot-mail-logo.svg";
import { noBranding, useBranding } from "~/composables/useBranding";

let state: ReturnType<typeof ref<BrandingView>>;

beforeEach(() => {
  state = ref<BrandingView>(noBranding());
  vi.stubGlobal("useState", () => state);
  vi.stubGlobal("useRuntimeConfig", () => ({ public: { apiBase: "/api" } }));
});

describe("useBranding", () => {
  it("shows the marks the interface ships with when the server gives no custom ones", () => {
    const { custom, icon, logo, favicon } = useBranding();
    expect(custom.value).toBe(false);
    expect(favicon.value).toBeNull();
    expect(icon.value).toBe(defaultIcon);
    expect(logo.value).toBe(defaultLogo);
    expect(defaultIcon).not.toBe(defaultLogo);
  });

  it("shows the icon and the logo of the server once it carries both", () => {
    state.value = { custom: true, version: "3f9a1c0b7d2e", favicon: null };
    const { custom, icon, logo } = useBranding();
    expect(custom.value).toBe(true);
    expect(icon.value).toBe("/api/v1/branding/icon?v=3f9a1c0b7d2e");
    expect(logo.value).toBe("/api/v1/branding/logo?v=3f9a1c0b7d2e");
  });

  it("follows the server: files dropped or removed change what is shown", () => {
    const { icon, logo } = useBranding();
    state.value = { custom: true, version: "aaaaaaaaaaaa", favicon: null };
    expect(icon.value).toBe("/api/v1/branding/icon?v=aaaaaaaaaaaa");
    state.value = { custom: true, version: "bbbbbbbbbbbb", favicon: null };
    expect(logo.value).toBe("/api/v1/branding/logo?v=bbbbbbbbbbbb");
    state.value = noBranding();
    expect(icon.value).toBe(defaultIcon);
    expect(logo.value).toBe(defaultLogo);
  });

  it("takes the favicon on its own: given alone, the icon and the logo stay the default ones", () => {
    state.value = { custom: false, version: null, favicon: "9c41d2aa07be" };
    const { custom, icon, logo, favicon } = useBranding();
    expect(favicon.value).toBe("/api/v1/branding/favicon?v=9c41d2aa07be");
    expect(custom.value).toBe(false);
    expect(icon.value).toBe(defaultIcon);
    expect(logo.value).toBe(defaultLogo);
  });

  it("keeps the default favicon when only the icon and the logo are given", () => {
    state.value = { custom: true, version: "3f9a1c0b7d2e", favicon: null };
    const { icon, favicon } = useBranding();
    expect(icon.value).toBe("/api/v1/branding/icon?v=3f9a1c0b7d2e");
    expect(favicon.value).toBeNull();
  });
});
