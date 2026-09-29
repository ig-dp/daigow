<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <h1 class="seller-page-title mb-6">Profil Saya</h1>
      <ProfileForm />
    </section>
  </main>
</template>

<script setup lang="ts">
import ProfileForm from '~/components/ProfileForm.vue'

definePageMeta({ middleware: 'auth', layout: 'account' })
useHead({ title: 'Profil' })
</script>
