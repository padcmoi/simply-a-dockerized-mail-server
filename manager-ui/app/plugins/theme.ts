import { useAuthStore } from "~/stores/auth";

// The server-wide theme is fetched by this app's own server and rendered into
// the first page as a stylesheet, so a visitor sees the personalisation in the
// first paint rather than watching it snap in after hydration. The login screen
// wears it too, which is why the API route behind it needs no token.
//
// The answer is held for a minute: a page render is not a reason to ask the API
// again, and a colour changed in the administration is on screen at the next
// minute without a restart.
const CACHE_MS = 60_000;

let cached: { at: number; theme: ThemeView } | null = null;

async function serverTheme(base: string) {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.theme;
  try {
    const data = await $fetch<ThemeView>(`${base}/api/v1/config/theme`);
    cached = { at: Date.now(), theme: { light: data.light ?? {}, dark: data.dark ?? {} } };
  } catch {
    // A theme is decoration: an API that cannot be reached leaves the interface
    // with the colours it ships with, and the page is served all the same.
    cached = { at: Date.now(), theme: emptyTheme() };
  }
  return cached.theme;
}

export default defineNuxtPlugin(async (nuxtApp) => {
  const app = useState<ThemeView>("theme-app", emptyTheme);
  const account = useState<ThemeView>("theme-account", emptyTheme);

  if (import.meta.server) {
    const config = useRuntimeConfig();
    app.value = await serverTheme(config.apiProxyTarget);
  }

  // Rendered into the head rather than written from a mounted component: the
  // stylesheet has to exist in the very first bytes, and the client takes this
  // element over by id instead of adding a second one.
  const css = computed(() => themeCss(mergeThemes(app.value, account.value)));
  useHead({
    style: [{ id: THEME_STYLE_ID, innerHTML: css, tagPriority: "critical" }],
  });

  if (import.meta.client) {
    const auth = useAuthStore();
    const { call } = useApi();

    // An account's own colours arrive with its session and leave with it: read
    // once there is someone to read them for, dropped on logout so the next
    // person on this browser gets the server's theme, not the last one's.
    watch(
      () => auth.session?.accountId,
      async (accountId) => {
        if (!accountId) {
          account.value = emptyTheme();
          return;
        }
        try {
          const data = await call<ThemeView>("/my-space/theme");
          account.value = { light: data.light ?? {}, dark: data.dark ?? {} };
        } catch {
          account.value = emptyTheme();
        }
      },
      { immediate: true }
    );

    // The server-wide theme is refreshed once on the client too, so a session
    // opened on a page served from the cache still sees the current colours.
    nuxtApp.hook("app:mounted", async () => {
      try {
        const data = await $fetch<ThemeView>("/api/v1/config/theme");
        app.value = { light: data.light ?? {}, dark: data.dark ?? {} };
      } catch {
        // Keep whatever the server rendered with.
      }
    });
  }
});
