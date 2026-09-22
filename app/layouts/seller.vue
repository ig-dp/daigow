<template>
  <div class="min-h-dvh bg-canvas text-ink md:flex">
    <aside class="flex flex-col border-b border-border bg-white md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div class="flex items-center justify-between gap-4 border-b border-border px-5 py-4 md:block md:px-6 md:py-5">
        <div>
          <p class="text-xl font-bold tracking-tight text-brand">DAIGOW</p>
          <p class="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Seller Dashboard</p>
        </div>
        <button
          type="button"
          class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-brand hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:hidden"
          :aria-label="menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'"
          :aria-expanded="menuOpen"
          aria-controls="seller-nav-panel"
          @click="menuOpen = !menuOpen"
        >
          <svg aria-hidden="true" class="h-5 w-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" viewBox="0 0 24 24">
            <path v-if="menuOpen" d="M5 5l14 14M19 5L5 19" />
            <path v-else d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      <div id="seller-nav-panel" class="flex-1 flex-col md:flex" :class="menuOpen ? 'flex' : 'hidden'">
        <nav class="flex flex-1 flex-col gap-1 p-4 md:p-5" aria-label="Navigasi seller">
          <NuxtLink
            v-for="link in NAV_LINKS"
            :key="link.to"
            :to="link.to"
            class="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            :class="isActive(link.to) ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-canvas'"
            @click="menuOpen = false"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="border-t border-border p-5">
          <p class="truncate text-sm font-medium text-ink">{{ user?.user_metadata?.name ?? 'Seller' }}</p>
          <p class="truncate text-xs text-muted">{{ user?.email }}</p>
          <button type="button" class="min-h-11 text-sm text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" @click="logout">Keluar</button>
        </div>
      </div>
    </aside>

    <main class="min-w-0 flex-1">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const NAV_LINKS = [
  { to: '/seller/dashboard', label: 'Dashboard' },
  { to: '/seller/orders', label: 'Pesanan' },
  { to: '/seller/products', label: 'Produk' },
  { to: '/seller/store', label: 'Toko' },
  { to: '/seller/profile', label: 'Profil' }
]

const route = useRoute()
const menuOpen = ref(false)
const user = useSupabaseUser()
const supabase = useSupabaseClient()

watch(() => route.path, () => { menuOpen.value = false })

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/')
}
</script>
