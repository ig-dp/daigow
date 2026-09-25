<template>
  <div role="tablist" :aria-label="label" class="flex gap-1 border-b border-border overflow-x-auto">
    <button
      v-for="(tab, index) in tabs"
      :id="tabId(tab.value)"
      :key="tab.value"
      ref="buttons"
      type="button"
      role="tab"
      :aria-selected="tab.value === modelValue"
      :tabindex="tab.value === modelValue ? 0 : -1"
      class="-mb-px px-3 py-2.5 border-b-2 font-medium text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2"
      :class="tab.value === modelValue ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink hover:border-border'"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  tabs: { value: string, label: string }[]
  label?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const uid = useId()
const buttons = ref<HTMLButtonElement[]>([])

const tabId = (value: string) => `${uid}-tab-${value}`

function select(index: number) {
  const tab = props.tabs[index]
  if (tab) emit('update:modelValue', tab.value)
}

function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.tabs.length - 1
  const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key]
  if (next === undefined) return
  event.preventDefault()
  select(next)
  buttons.value[next]?.focus()
}
</script>
