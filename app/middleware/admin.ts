// UX only: the real check is requireAdmin on every /api/admin/* route.
export default defineNuxtRouteMiddleware(async () => {
  if (!useSupabaseUser().value) return navigateTo('/admin')
  if (await useAdminRole().load() !== 'admin') return navigateTo('/admin')
})
