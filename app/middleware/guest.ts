// Login page only: signed-in sellers go straight to their dashboard.
export default defineNuxtRouteMiddleware(() => {
  const user = useSupabaseUser()
  if (user.value) return navigateTo('/seller/dashboard')
})
