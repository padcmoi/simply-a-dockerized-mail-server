// Whether this server carries its own icon, logo and favicon is asked by this app's own
// server and rendered into the first page, so the sign-in screen shows the
// right logo in the first paint instead of swapping it after hydration.
//
// The answer is held for a minute: a page render is not a reason to ask the API
// again, and two files dropped at the root of the project are on screen at the
// next minute without a restart.
const CACHE_MS = 60_000;

let cached: { at: number; branding: BrandingView } | null = null;

async function serverBranding(base: string) {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.branding;
  try {
    const data = await $fetch<BrandingView>(`${base}/api/v1/branding`);
    cached = {
      at: Date.now(),
      branding: { custom: data.custom === true, version: data.version ?? null, favicon: data.favicon ?? null },
    };
  } catch {
    cached = { at: Date.now(), branding: noBranding() };
  }
  return cached.branding;
}

export default defineNuxtPlugin(async () => {
  const state = useState<BrandingView>("branding", noBranding);

  if (import.meta.server) {
    state.value = await serverBranding(useRuntimeConfig().apiProxyTarget);
  }
});
