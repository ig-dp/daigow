import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@nuxt/icon'],
  css: ['~/assets/css/main.css'],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@100..1000&display=swap' }
      ]
    }
  },
  vite: {
    plugins: [tailwindcss()]
  },
  // Old seller login URL; login now lives at /login.
  routeRules: {
    '/seller': { redirect: '/seller/dashboard' }
  },
  nitro: {
    errorHandler: '../server/error.ts'
  },
  supabase: {
    // Guests use tracking tokens, not sessions — don't force login redirects.
    redirect: false
  },
  runtimeConfig: {
    // Server-only secrets (never exposed to client)
    supabaseServiceRoleKey: '',
    xenditSecretKey: '',
    xenditWebhookToken: '',
    geminiApiKey: '',
    resendApiKey: '',
    cronSecret: ''
  }
})
