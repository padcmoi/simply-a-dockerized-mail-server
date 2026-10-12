import defaultIcon from "~/assets/favicon.svg";
import defaultLogo from "~/assets/naskot-mail-logo.svg";

export function noBranding() {
  const none: BrandingView = { custom: false, version: null, favicon: null };
  return none;
}

export function useBranding() {
  const state = useState<BrandingView>("branding", noBranding);
  const base = `${useRuntimeConfig().public.apiBase ?? "/api"}/v1/branding`;

  const custom = computed(() => state.value.custom === true);
  const icon = computed(() => (custom.value ? `${base}/icon?v=${state.value.version ?? ""}` : defaultIcon));
  const logo = computed(() => (custom.value ? `${base}/logo?v=${state.value.version ?? ""}` : defaultLogo));
  const favicon = computed(() => (state.value.favicon ? `${base}/favicon?v=${state.value.favicon}` : null));

  return { custom, icon, logo, favicon };
}
