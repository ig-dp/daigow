<template>
  <div>
    <label class="field-label" :for="id">{{ label }}</label>
    <input
      :id="id"
      :name="name"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :aria-describedby="error ? `${id}-error` : undefined"
      :aria-invalid="Boolean(error)"
      class="field-input"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <p v-if="error" :id="`${id}-error`" class="field-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  id: string
  name: string
  label: string
  modelValue: string
  type?: string
  placeholder?: string
  autocomplete?: string
  error?: string
}>(), {
  type: 'text',
  placeholder: '',
  autocomplete: 'off',
  error: ''
})

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
