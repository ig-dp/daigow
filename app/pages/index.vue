<template>
  <div class="auth-canvas">
    <AppLogo />
    <NuxtLink to="/seller" class="inline-flex justify-center items-center gap-2 bg-brand hover:bg-brand-hover px-6 rounded-md w-full max-w-xs min-h-12 font-semibold text-white text-sm focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2">
      <Icon name="material-symbols:storefront-outline-rounded" class="text-xl" aria-hidden="true" />
      Masuk sebagai Penjual
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import AppLogo from '~/components/ui/AppLogo.vue'

useHead({ title: 'Daigow' })
</script>
