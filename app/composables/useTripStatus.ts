export const TRIP_STATUS: Record<string, { label: string, chip: string, dot: string }> = {
  coming_soon: { label: 'Coming Soon', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  open: { label: 'Open', chip: 'bg-green-100 text-green-800', dot: 'bg-green-600' },
  closed: { label: 'Closed', chip: 'bg-zinc-200 text-zinc-700', dot: 'bg-zinc-400' }
}

// Unknown statuses fall back to "snake_case" → "Snake Case" so new values never render raw.
export function formatTripStatus(status?: string | null) {
  if (!status) return ''
  return TRIP_STATUS[status]?.label ?? status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function tripStatusClass(status?: string | null) {
  return TRIP_STATUS[status ?? '']?.chip ?? 'bg-zinc-100 text-zinc-700'
}

export function tripStatusDotClass(status?: string | null) {
  return TRIP_STATUS[status ?? '']?.dot ?? 'bg-zinc-400'
}

// AppSelect option for a trip filter: thumbnail + status dot + title.
export function tripSelectOption(trip: { id: string, title: string, status: string, thumbnail_url?: string | null }) {
  return { value: trip.id, label: trip.title, image: trip.thumbnail_url ?? undefined, dot: tripStatusDotClass(trip.status) }
}
