<template>
  <div class="flex items-center gap-4">
    <NuxtLink v-if="backTo" :to="backTo" :aria-label="backLabel" :title="backLabel" class="px-0 size-10 seller-secondary-button min-h-10 shrink-0">
      <Icon name="material-symbols:arrow-back-rounded" class="text-xl" aria-hidden="true" />
    </NuxtLink>
    <div class="min-w-0">
      <h1 class="seller-page-title">{{ title }}</h1>
      <p v-if="subtitle" class="seller-page-subtitle">{{ subtitle }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
}>(), {
  subtitle: '',
  backTo: '',
  backLabel: 'Kembali'
})
</script>
