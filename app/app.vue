<template>
  <NuxtLoadingIndicator color="#173f3b" :height="3" />
  <NuxtLayout>
    <NuxtPage :class="{ 'page-loading': pageLoading }" />
  </NuxtLayout>
</template>

<script setup lang="ts">
const pageLoading = useState('page-loading', () => false)
</script>
