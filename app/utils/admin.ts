import { ORDER_STATUS } from './seller-order-status.mjs'

const TONE_CLASS: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  violet: 'bg-violet-100 text-violet-800',
  sky: 'bg-sky-100 text-sky-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800'
}

export function orderStatusBadge(status: string) {
  const meta = ORDER_STATUS[status as keyof typeof ORDER_STATUS]
  return { label: meta?.label ?? status, class: TONE_CLASS[meta?.tone ?? ''] ?? 'bg-gray-100 text-gray-800' }
}

export const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
export const formatDateTime = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

// Maps a failed admin action to a message; 409 means someone/something already changed it.
export function adminActionError(error: unknown) {
  const { statusCode, data } = error as { statusCode?: number, data?: { error?: { code?: string } } }
  const code = data?.error?.code
  if (code === 'PAYOUT_ERROR') return 'Pesanan sudah dirilis, tetapi payout gagal dibuat. Cek log server lalu buat payout secara manual.'
  if (code === 'REFUND_ERROR') return 'Pesanan sudah dibatalkan, tetapi refund gagal dicatat. Cek log server lalu catat refund secara manual.'
  if (statusCode === 409) return 'Status sudah berubah. Data dimuat ulang, periksa kembali.'
  return 'Tindakan gagal. Periksa koneksi lalu coba lagi.'
}

export const REFUND_TYPE: Record<string, string> = { partial_item: 'Item dibatalkan', full_order: 'Pesanan dibatalkan seller', admin_cancel: 'Dibatalkan admin' }
