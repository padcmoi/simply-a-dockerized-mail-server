export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },
  modules: [
    "@nuxt/ui",
    "@nuxt/eslint",
    "@vueuse/nuxt",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
    "@nuxtjs/i18n",
    // vue-router@4.6 dropped the `./volar/sfc-route-blocks` subpath export but
    // Nuxt core still pushes it into the generated tsconfig, causing vue-tsc to
    // spam `Load plugin failed` on every typecheck. Strip it here so the noise
    // disappears without affecting the actual router types.
    (_, nuxt) => {
      nuxt.hook("modules:done", () => {
        nuxt.hook("prepare:types", ({ tsConfig }) => {
          const plugins = tsConfig.vueCompilerOptions?.plugins;
          if (Array.isArray(plugins) && tsConfig.vueCompilerOptions) {
            tsConfig.vueCompilerOptions.plugins = plugins.filter((p) => p !== "vue-router/volar/sfc-route-blocks");
          }
        });
      });
    },
  ],
  i18n: {
    strategy: "no_prefix",
    defaultLocale: "en_EN",
    locales: [
      { code: "en_EN", name: "English", file: "en_EN.ts" },
      { code: "fr_FR", name: "Français", file: "fr_FR.ts" },
    ],
    detectBrowserLanguage: { useCookie: true, cookieKey: "i18n_locale", redirectOn: "root" },
  },
  ssr: true,
  css: ["~/assets/css/main.css"],
  // Bundle every `i-lucide-*` icon used in templates into the client output
  // so they render offline / behind a strict CSP that blocks the iconify CDN.
  // `serverBundle: "local"` makes the SSR pass resolve from the installed
  // `@iconify-json/lucide` package on disk instead of an HTTP call.
  icon: {
    serverBundle: "local",
    clientBundle: {
      scan: true,
      includeCustomCollections: true,
    },
  },
  runtimeConfig: {
    apiProxyTarget: process.env.NUXT_API_PROXY_TARGET ?? "http://mail-manager-api:3000",
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE ?? "/api" },
  },
  nitro: {
    routeRules: {
      "/api/v1/**": {
        proxy: { to: `${process.env.NUXT_API_PROXY_TARGET ?? "http://mail-manager-api:3000"}/api/v1/**` },
      },
    },
  },
});
