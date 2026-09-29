<template>
  <div class="min-h-dvh bg-white text-ink md:flex">
    <aside class="flex flex-col border-b border-border bg-white md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div class="flex items-center justify-between gap-4 border-b border-border px-5 py-4 md:block md:px-6 md:py-5">
        <div>
          <p class="flex items-baseline gap-2 text-xl font-bold tracking-tight text-brand"><img src="/logo.svg" alt="" class="h-[1.5cap] w-auto translate-y-[0.25cap]">DAIGOW</p>
          <p class="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Seller Dashboard</p>
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
          <template v-for="link in NAV_LINKS" :key="link.to">
            <span
              v-if="link.requiresTrip && !hasTrips"
              role="link"
              aria-disabled="true"
              title="Buat trip terlebih dahulu"
              class="flex items-center gap-3 opacity-50 px-3 rounded-lg min-h-11 font-medium text-muted text-sm cursor-not-allowed"
            >
              <Icon :name="link.icon" class="text-xl shrink-0" aria-hidden="true" />
              {{ link.label }}
            </span>
            <NuxtLink
              v-else
              :to="link.to"
              class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              :class="isActive(link.to) ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-canvas'"
              @click="menuOpen = false"
            >
              <Icon :name="link.icon" class="shrink-0 text-xl" aria-hidden="true" />
              {{ link.label }}
            </NuxtLink>
          </template>
        </nav>

        <div class="relative border-t border-border p-3" @focusout="onProfileFocusOut" @keydown.esc="profileOpen = false">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
            :class="{ 'bg-canvas': profileOpen }"
            aria-haspopup="menu"
            :aria-expanded="profileOpen"
            @click="profileOpen = !profileOpen"
          >
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-semibold text-brand" aria-hidden="true">{{ initials }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-ink">{{ displayName }}</span>
              <span class="block truncate text-xs text-muted">{{ user?.email }}</span>
            </span>
            <Icon name="material-symbols:more-vert" class="shrink-0 text-xl text-ink" aria-hidden="true" />
          </button>
          <div v-if="profileOpen" role="menu" class="absolute inset-x-3 bottom-full mb-1 rounded-lg border border-border bg-white p-1 shadow-lg">
            <NuxtLink to="/seller/profile" role="menuitem" class="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-ink hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none">
              <Icon name="material-symbols:person-outline-rounded" class="text-lg" aria-hidden="true" />Profil
            </NuxtLink>
            <button type="button" role="menuitem" class="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-sm text-ink hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none" @click="logout">
              <Icon name="material-symbols:logout-rounded" class="text-lg" aria-hidden="true" />Keluar
            </button>
          </div>
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
  { to: '/seller/dashboard', label: 'Dashboard', icon: 'material-symbols:dashboard-outline-rounded' },
  { to: '/seller/orders', label: 'Pesanan', icon: 'material-symbols:receipt-long-outline-rounded', requiresTrip: true },
  { to: '/seller/products', label: 'Produk', icon: 'material-symbols:inventory-2-outline-rounded', requiresTrip: true },
  { to: '/seller/payout-account', label: 'Payout', icon: 'material-symbols:account-balance-wallet-outline-rounded' },
  { to: '/seller/profile', label: 'Profil', icon: 'material-symbols:person-outline-rounded' }
]

const route = useRoute()
useHead({ titleTemplate: (title) => title ? `${title} | Daigow Seller` : 'Daigow Seller' })
const menuOpen = ref(false)
const profileOpen = ref(false)
const user = useSupabaseUser()
const supabase = useSupabaseClient()

// Orders and products belong to a trip, so their menus stay disabled until the seller has one.
const { data: tripsData, refresh: refreshTrips } = await useFetch('/api/seller/trips', { key: 'seller-nav-trips' })
const hasTrips = computed(() => (tripsData.value?.trips?.length ?? 0) > 0)
watch(() => route.path, () => { if (!hasTrips.value) refreshTrips() })

const displayName = computed(() => user.value?.user_metadata?.name || 'Seller')
const initials = computed(() => displayName.value.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())

watch(() => route.path, () => { menuOpen.value = false; profileOpen.value = false })

function onProfileFocusOut(e: FocusEvent) {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) profileOpen.value = false
}

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/seller')
}
</script>
