import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
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
    cronSecret: '',
    jastiperInviteCode: ''
  }
})
