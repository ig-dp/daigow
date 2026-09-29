// Login/register only: signed-in users go to their home (sellers → dashboard, buyers → account).
export default defineNuxtRouteMiddleware(async () => {
  if (!useSupabaseUser().value) return
  const role = await useAdminRole().load()
  return navigateTo(role === 'jastiper' || role === 'admin' ? '/seller/dashboard' : '/account')
})
