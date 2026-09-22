<template>
  <div class="min-h-dvh bg-canvas text-ink md:flex">
    <aside class="flex flex-col border-b border-border bg-white md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div class="border-b border-border px-6 py-5">
        <p class="text-xl font-bold tracking-tight text-brand">DAIGOW</p>
        <p class="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Seller Dashboard</p>
      </div>

      <nav class="flex flex-1 flex-row flex-wrap gap-1 p-4 md:flex-col md:p-5">
        <NuxtLink
          v-for="link in NAV_LINKS"
          :key="link.to"
          :to="link.to"
          class="min-h-11 rounded-lg px-3 text-sm font-medium transition-colors"
          :class="isActive(link.to) ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-canvas'"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="border-t border-border p-5">
        <p class="truncate text-sm font-medium text-ink">{{ user?.user_metadata?.name ?? 'Seller' }}</p>
        <p class="truncate text-xs text-muted">{{ user?.email }}</p>
        <button type="button" class="mt-3 text-sm text-muted hover:text-brand" @click="logout">Keluar</button>
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
const user = useSupabaseUser()
const supabase = useSupabaseClient()

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/')
}
</script>
