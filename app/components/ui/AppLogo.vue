<template>
  <div class="text-center">
    <p class="auth-logo"><img src="/logo.svg" alt="" class="h-[1.5cap] w-auto translate-y-[0.25cap]">DAIGOW</p>
    <p v-if="subtitle" class="auth-subtitle">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ subtitle?: string }>()
</script>
