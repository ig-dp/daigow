// UX only: the real check is requireSeller on every /api/seller/* route.
export default defineNuxtRouteMiddleware(async () => {
  if (!useSupabaseUser().value) return navigateTo('/login')
  const role = await useAdminRole().load()
  if (role !== 'jastiper' && role !== 'admin') return navigateTo('/account')
})
