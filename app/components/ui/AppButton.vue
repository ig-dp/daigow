<template>
  <button :type="type" class="btn-primary" :disabled="disabled">
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ type?: 'button' | 'submit'; disabled?: boolean }>(), {
  type: 'button',
  disabled: false
})
</script>
