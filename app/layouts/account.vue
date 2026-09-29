<template>
  <DashboardShell label="Akun Saya" profile-to="/account/profile" :links="links">
    <slot />
  </DashboardShell>
</template>

<script setup lang="ts">
import DashboardShell from '~/components/DashboardShell.vue'

useHead({ titleTemplate: (title) => title ? `${title} | Daigow` : 'Daigow' })

const role = await useAdminRole().load()
const isSeller = role === 'jastiper' || role === 'admin'

const links = [
  { to: '/account/orders', label: 'Pesanan Saya', icon: 'material-symbols:receipt-long-outline-rounded' },
  { to: '/account/profile', label: 'Profil', icon: 'material-symbols:person-outline-rounded' },
  isSeller
    ? { to: '/seller/dashboard', label: 'Seller Dashboard', icon: 'material-symbols:storefront-outline-rounded' }
    : { to: '/account/seller', label: 'Jadi Seller', icon: 'material-symbols:storefront-outline-rounded' }
]
</script>
