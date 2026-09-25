import type { Ref } from 'vue'

// Trip filter shared by the Pesanan and Produk pages, so switching pages keeps the same trip.
// Stored in a cookie so it also survives reloads and is available during SSR.
// Falls back to the newest trip (trips arrive newest first) when the saved one no longer exists.
export function useSelectedTrip(trips: Ref<{ id: string }[] | undefined>) {
  const saved = useCookie<string>('seller-trip', { default: () => '', sameSite: 'lax' })
  return computed({
    get: () => {
      const list = trips.value ?? []
      return list.some(trip => trip.id === saved.value) ? saved.value : list[0]?.id ?? ''
    },
    set: (id: string) => { saved.value = id }
  })
}
