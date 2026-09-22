export function descriptionSource(description, aiDraft) {
  if (!aiDraft) return 'manual'
  return description === aiDraft ? 'ai' : 'ai_edited'
}

export function parseRupiah(value) {
  if (!/^\d+$/.test(String(value))) return null
  const amount = Number(value)
  return Number.isSafeInteger(amount) ? amount : null
}
