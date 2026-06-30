export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },
  modules: ["@nuxt/ui", "@nuxt/eslint", "@vueuse/nuxt", "@pinia/nuxt", "pinia-plugin-persistedstate/nuxt"],
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
