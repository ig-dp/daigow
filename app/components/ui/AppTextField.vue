<template>
  <div>
    <label class="field-label" :for="id">
      {{ required ? label.trimEnd().slice(0, -1).trimEnd() : label }}
      <span v-if="required" class="text-red-600">*</span>
    </label>
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
const props = withDefaults(defineProps<{
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

// Labels mark required fields with a trailing "*" (e.g. "Judul Trip *"); render it in red.
const required = computed(() => props.label.trimEnd().endsWith('*'))
</script>
