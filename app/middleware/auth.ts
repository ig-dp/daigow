export default defineNuxtRouteMiddleware(() => {
  if (!useSupabaseUser().value) return navigateTo('/login')
})
