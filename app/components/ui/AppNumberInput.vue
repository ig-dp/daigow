<template>
  <div class="relative" :class="attrs.class">
    <span v-if="prefix" class="left-4 absolute inset-y-0 flex items-center text-muted text-sm pointer-events-none" aria-hidden="true">{{ prefix }}</span>
    <input
      v-bind="inputAttrs"
      :id="id"
      ref="input"
      :value="display"
      type="text"
      :inputmode="decimalScale > 0 ? 'decimal' : 'numeric'"
      autocomplete="off"
      class="field-input"
      :class="{ 'pl-11': prefix }"
      @input="onInput"
    >
  </div>
</template>

<script setup lang="ts">
import { formatNumeral, registerCursorTracker, unformatNumeral } from 'cleave-zen'
import type { CursorTrackerDestructor } from 'cleave-zen'

// Indonesian format: "1.250.000,5". v-model stays a plain number string ("1250000.5") so callers can parse it directly.
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue: string | number | null | undefined
  id?: string
  prefix?: string
  decimalScale?: number
}>(), {
  id: undefined,
  prefix: '',
  decimalScale: 0
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const input = ref<HTMLInputElement>()
const DELIMITER = '.'
const DECIMAL_MARK = ','
const options = computed(() => ({
  delimiter: DELIMITER,
  numeralDecimalMark: DECIMAL_MARK,
  numeralDecimalScale: props.decimalScale,
  numeralPositiveOnly: true,
  stripLeadingZeroes: true
}))

const display = computed(() => {
  const raw = props.modelValue == null ? '' : String(props.modelValue)
  return raw ? formatNumeral(raw.replace('.', DECIMAL_MARK), options.value) : ''
})

function onInput(event: Event) {
  const el = event.target as HTMLInputElement
  el.value = formatNumeral(el.value, options.value)
  emit('update:modelValue', unformatNumeral(el.value, { numeralDecimalMark: DECIMAL_MARK }))
}

let destroyCursorTracker: CursorTrackerDestructor | undefined
onMounted(() => {
  if (input.value) destroyCursorTracker = registerCursorTracker({ input: input.value, delimiter: DELIMITER })
})
onBeforeUnmount(() => destroyCursorTracker?.())
</script>
