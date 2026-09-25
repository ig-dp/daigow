// CORS for the admin SPA: only /api/me and /api/admin/*, only from ADMIN_APP_ORIGIN.
export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]
  if (path !== '/api/me' && !path.startsWith('/api/admin/')) return

  const origin = useRuntimeConfig(event).adminAppOrigin
  if (!origin) return

  const handled = handleCors(event, {
    origin: [origin],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    preflight: { statusCode: 204 }
  })
  if (handled) return null
})
