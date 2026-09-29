<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <AppPageTitle title="Profil Saya" back-to="/seller/dashboard" back-label="Kembali" class="mb-6" />
      <ProfileForm />
    </section>
  </main>
</template>

<script setup lang="ts">
import AppPageTitle from '~/components/ui/AppPageTitle.vue'
import ProfileForm from '~/components/ProfileForm.vue'

definePageMeta({ middleware: 'seller', layout: 'seller' })
useHead({ title: 'Profil' })
</script>
