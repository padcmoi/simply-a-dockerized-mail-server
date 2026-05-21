// Nuxt config - SPA mode (we mount behind nginx, manager-api is the only backend)
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vueuse/nuxt'],
  app: {
    head: {
      title: 'Mail manager',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4003/api/v1',
      auth0Domain: process.env.NUXT_PUBLIC_AUTH0_DOMAIN ?? '',
      auth0ClientId: process.env.NUXT_PUBLIC_AUTH0_CLIENT_ID ?? '',
      auth0Audience: process.env.NUXT_PUBLIC_AUTH0_AUDIENCE ?? '',
    },
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },
  compatibilityDate: '2025-01-01',
});
