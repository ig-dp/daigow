<template>
  <div class="auth-canvas">
    <AppLogo :subtitle="subtitle" />
    <div class="auth-card">
      <slot />
    </div>
    <p v-if="$slots.footer" class="text-center text-sm link-muted">
      <slot name="footer" />
    </p>
  </div>
</template>

<script setup lang="ts">
import AppLogo from '../ui/AppLogo.vue'

defineProps<{ subtitle: string }>()
</script>
