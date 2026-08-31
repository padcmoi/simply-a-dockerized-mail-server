export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: process.env.NODE_ENV === "development" },
  // Components live in business-domain subfolders (accounts/, domains/,
  // groups/, etc.) for organization, not for Nuxt's default folder-name
  // prefixing -- pathPrefix: false keeps every component's registered tag
  // the same regardless of which subfolder it's filed under.
  components: [{ path: "~/components", pathPrefix: false }],
  // Every type lives under app/types/** and nothing else declares one: the
  // whole tree is fed to the auto-import so components and composables use a
  // shared type by name, without an import line at the top of each file.
  imports: { dirs: ["types/**"] },
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
          // Nuxt's generated tsconfig includes only test/nuxt, so vue-tsc never
          // type-checked the vitest suite under test/. Add it so `typecheck`
          // covers the specs the same way it covers app code (paths generated in
          // .nuxt, hence the ../ prefix).
          tsConfig.include = tsConfig.include ?? [];
          if (!tsConfig.include.includes("../test/**/*.ts")) tsConfig.include.push("../test/**/*.ts");
        });
      });
    },
  ],
  i18n: {
    strategy: "no_prefix",
    defaultLocale: "en_GB",
    locales: [
      { code: "en_GB", name: "English", file: "en_GB.ts" },
      { code: "fr_FR", name: "Français", file: "fr_FR.ts" },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_locale",
      redirectOn: "root",
    },
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
    realtimeTarget: process.env.NUXT_REALTIME_TARGET ?? "ws://mail-manager-api:3001",
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE ?? "/api" },
  },
  nitro: {
    experimental: { websocket: true },
    routeRules: {
      "/api/v1/**": {
        proxy: {
          to: `${process.env.NUXT_API_PROXY_TARGET ?? "http://mail-manager-api:3000"}/api/v1/**`,
        },
      },
      // Swagger UI HTML + static assets (CSS/JS/icons served relative to /api/doc/).
      "/api/doc": {
        proxy: {
          to: `${process.env.NUXT_API_PROXY_TARGET ?? "http://mail-manager-api:3000"}/api/doc`,
        },
      },
      "/api/doc/**": {
        proxy: {
          to: `${process.env.NUXT_API_PROXY_TARGET ?? "http://mail-manager-api:3000"}/api/doc/**`,
        },
      },
      "/api/doc-json": {
        proxy: {
          to: `${process.env.NUXT_API_PROXY_TARGET ?? "http://mail-manager-api:3000"}/api/doc-json`,
        },
      },
      "/api/doc-yaml": {
        proxy: {
          to: `${process.env.NUXT_API_PROXY_TARGET ?? "http://mail-manager-api:3000"}/api/doc-yaml`,
        },
      },
    },
  },
});
