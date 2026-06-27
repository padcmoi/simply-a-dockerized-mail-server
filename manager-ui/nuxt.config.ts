export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@pinia-plugin-persistedstate/nuxt'],
  ssr: true,
  runtimeConfig: {
    apiProxyTarget: process.env.NUXT_API_PROXY_TARGET ?? 'http://mail-manager-api:3000',
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE ?? '/api' },
  },
  nitro: {
    routeRules: {
      '/api/**': {
        proxy: { to: `${process.env.NUXT_API_PROXY_TARGET ?? 'http://mail-manager-api:3000'}/api/**` },
      },
    },
  },
})
