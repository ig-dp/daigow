<template>
  <div class="text-center">
    <p class="auth-logo">DAIGOW</p>
    <p class="auth-subtitle">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ subtitle: string }>()
</script>
