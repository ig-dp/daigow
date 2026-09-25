<template>
  <div ref="root" class="relative" :class="attrs.class">
    <button
      :id="id"
      ref="trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      :aria-invalid="invalid || undefined"
      :aria-describedby="attrs['aria-describedby'] as string | undefined"
      :disabled="disabled"
      class="flex justify-between items-center gap-2 bg-white disabled:bg-canvas px-3 border rounded-md w-full min-h-11 text-sm text-left transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 disabled:opacity-60"
      :class="invalid ? 'border-red-500' : open ? 'border-brand ring-2 ring-brand/20' : 'border-field hover:border-muted/50 focus-visible:border-brand'"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="flex items-center gap-2 min-w-0">
        <img v-if="selected?.image" :src="selected.image" alt="" class="bg-field rounded object-cover size-7 shrink-0">
        <Icon v-if="selected?.icon" :name="selected.icon" class="rounded-full ring-1 ring-black/10 text-base shrink-0" aria-hidden="true" />
        <span v-if="selected?.dot" class="rounded-full size-2 shrink-0" :class="selected.dot" aria-hidden="true" />
        <span class="truncate" :class="selected ? 'text-ink' : 'text-muted/70'">{{ selected?.label ?? placeholder }}</span>
      </span>
      <span v-if="selected?.badge" class="ml-auto bg-red-600 px-1.5 rounded-full min-w-5 font-semibold text-[11px] text-white text-center leading-5 shrink-0">{{ selected.badge }}</span>
      <Icon name="material-symbols:expand-more-rounded" class="text-muted text-xl transition-transform shrink-0" :class="{ 'rotate-180': open }" aria-hidden="true" />
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="open" class="z-30 absolute bg-white shadow-lg mt-1 border border-border rounded-lg w-full min-w-max overflow-hidden">
        <div v-if="searchable" class="flex items-center gap-2 px-3 border-b border-border">
          <Icon name="material-symbols:search-rounded" class="text-muted text-lg shrink-0" aria-hidden="true" />
          <input
            ref="search"
            v-model="query"
            type="search"
            :placeholder="searchPlaceholder"
            :aria-label="searchPlaceholder"
            :aria-controls="listboxId"
            :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
            autocomplete="off"
            class="bg-transparent py-2.5 outline-none w-full text-sm placeholder:text-muted/70"
            @keydown="onKeydown($event, true)"
          >
        </div>
        <ul
          :id="listboxId"
          ref="listbox"
          role="listbox"
          :aria-labelledby="id"
          class="p-1 max-h-64 overflow-auto"
        >
          <li v-if="!visibleOptions.length" class="px-2.5 py-2 text-muted text-sm">Tidak ditemukan</li>
          <li
            v-for="(option, index) in visibleOptions"
            :id="optionId(index)"
            :key="option.value"
            role="option"
            :aria-selected="option.value === modelValue"
            class="flex justify-between items-center gap-3 px-2.5 py-2 rounded-md text-sm cursor-pointer"
            :class="[
              index === activeIndex ? 'bg-canvas' : '',
              option.value === modelValue ? 'font-medium text-brand' : 'text-ink'
            ]"
            @mousemove="activeIndex = index"
            @mousedown.prevent
            @click="choose(index)"
          >
            <span class="flex items-center gap-2 min-w-0">
              <img v-if="option.image" :src="option.image" alt="" loading="lazy" class="bg-field rounded object-cover size-7 shrink-0">
              <Icon v-if="option.icon" :name="option.icon" class="rounded-full ring-1 ring-black/10 text-base shrink-0" aria-hidden="true" />
              <span v-if="option.dot" class="rounded-full size-2 shrink-0" :class="option.dot" aria-hidden="true" />
              <span class="truncate">{{ option.label }}</span>
            </span>
            <span v-if="option.badge" class="ml-auto bg-red-600 px-1.5 rounded-full min-w-5 font-semibold text-[11px] text-white text-center leading-5 shrink-0">{{ option.badge }}</span>
            <Icon v-if="option.value === modelValue" name="material-symbols:check-rounded" class="text-lg shrink-0" aria-hidden="true" />
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
export interface SelectOption { value: string, label: string, keywords?: string, icon?: string, dot?: string, image?: string, badge?: string }

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue: string
  options: SelectOption[]
  id?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  searchable?: boolean
  searchPlaceholder?: string
}>(), {
  placeholder: 'Pilih',
  disabled: false,
  invalid: false,
  searchable: false,
  searchPlaceholder: 'Cari...'
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const attrs = useAttrs()
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const listbox = ref<HTMLUListElement>()
const search = ref<HTMLInputElement>()
const query = ref('')
const open = ref(false)
const activeIndex = ref(-1)

const uid = useId()
const id = computed(() => props.id ?? uid)
const listboxId = computed(() => `${id.value}-listbox`)
const selected = computed(() => props.options.find(option => option.value === props.modelValue))
const optionId = (index: number) => `${id.value}-option-${index}`

const visibleOptions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(option => `${option.label} ${option.keywords ?? ''}`.toLowerCase().includes(q))
})

watch(query, () => move(0))

function show() {
  if (props.disabled || !props.options.length) return
  query.value = ''
  open.value = true
  activeIndex.value = Math.max(0, props.options.findIndex(option => option.value === props.modelValue))
  nextTick(() => {
    search.value?.focus()
    scrollActiveIntoView()
  })
}

function hide() {
  open.value = false
}

function toggle() {
  open.value ? hide() : show()
}

function choose(index: number) {
  const option = visibleOptions.value[index]
  if (option) emit('update:modelValue', option.value)
  hide()
  trigger.value?.focus()
}

function move(to: number) {
  activeIndex.value = Math.min(Math.max(to, 0), visibleOptions.value.length - 1)
  nextTick(scrollActiveIntoView)
}

function scrollActiveIntoView() {
  listbox.value?.querySelector(`#${CSS.escape(optionId(activeIndex.value))}`)?.scrollIntoView({ block: 'nearest' })
}

// fromInput: Home/End/Space belong to the search text, not the list.
function onKeydown(event: KeyboardEvent, fromInput = false) {
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      show()
    }
    return
  }
  switch (event.key) {
    case 'ArrowDown': event.preventDefault(); move(activeIndex.value + 1); break
    case 'ArrowUp': event.preventDefault(); move(activeIndex.value - 1); break
    case 'Home': if (!fromInput) { event.preventDefault(); move(0) } break
    case 'End': if (!fromInput) { event.preventDefault(); move(visibleOptions.value.length - 1) } break
    case ' ': if (!fromInput) { event.preventDefault(); choose(activeIndex.value) } break
    case 'Enter': event.preventDefault(); choose(activeIndex.value); break
    case 'Escape': event.preventDefault(); hide(); trigger.value?.focus(); break
    case 'Tab': hide(); break
  }
}

function onPointerDown(event: PointerEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) hide()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>
