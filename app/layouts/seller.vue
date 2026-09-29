<template>
  <DashboardShell label="Seller Dashboard" profile-to="/seller/profile" :links="links">
    <slot />
  </DashboardShell>
</template>

<script setup lang="ts">
import DashboardShell from '~/components/DashboardShell.vue'

const route = useRoute()
useHead({ titleTemplate: (title) => title ? `${title} | Daigow Seller` : 'Daigow Seller' })

// Orders and products belong to a trip, so their menus stay disabled until the seller has one.
const { data: tripsData, refresh: refreshTrips } = await useFetch('/api/seller/trips', { key: 'seller-nav-trips' })
const hasTrips = computed(() => (tripsData.value?.trips?.length ?? 0) > 0)
watch(() => route.path, () => { if (!hasTrips.value) refreshTrips() })

const links = computed(() => {
  const needsTrip = hasTrips.value ? undefined : 'Buat trip terlebih dahulu'
  return [
    { to: '/seller/dashboard', label: 'Dashboard', icon: 'material-symbols:dashboard-outline-rounded' },
    { to: '/seller/orders', label: 'Pesanan', icon: 'material-symbols:receipt-long-outline-rounded', disabled: needsTrip },
    { to: '/seller/products', label: 'Produk', icon: 'material-symbols:inventory-2-outline-rounded', disabled: needsTrip },
    { to: '/seller/payout-account', label: 'Payout', icon: 'material-symbols:account-balance-wallet-outline-rounded' },
    { to: '/seller/profile', label: 'Profil', icon: 'material-symbols:person-outline-rounded' }
  ]
})
</script>
