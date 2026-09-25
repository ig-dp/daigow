// Tracks page navigation so the current page can blur while the next page's data loads.
export default defineNuxtPlugin((nuxtApp) => {
  const pageLoading = useState('page-loading', () => false)
  nuxtApp.hook('page:loading:start', () => { pageLoading.value = true })
  nuxtApp.hook('page:loading:end', () => { pageLoading.value = false })
  nuxtApp.hook('app:error', () => { pageLoading.value = false })
})
