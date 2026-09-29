export const ORDER_STATUS = {
  awaiting_confirmation: { label: 'Menunggu Konfirmasi', tone: 'amber', description: 'Periksa ketersediaan item sebelum meminta pembeli membayar.' },
  awaiting_payment: { label: 'Menunggu Pembayaran', tone: 'amber', description: 'Pesanan telah dikonfirmasi. Pembeli perlu menyelesaikan pembayaran.' },
  processing: { label: 'Diproses', tone: 'blue', description: 'Pembayaran diterima. Siapkan item dan masukkan informasi pengiriman.' },
  shipped: { label: 'Dikirim', tone: 'violet', description: 'Pesanan dalam pengiriman. Tandai diterima setelah ada kepastian dari pembeli.' },
  delivered: { label: 'Diterima', tone: 'sky', description: 'Menunggu pembeli mengonfirmasi penerimaan atau penyelesaian otomatis.' },
  completed: { label: 'Selesai', tone: 'green', description: 'Pesanan selesai. Periksa status pencairan dana di bawah.' },
  cancelled: { label: 'Dibatalkan', tone: 'red', description: 'Pesanan telah dibatalkan dan tidak dapat diproses lagi.' }
}

export const ORDER_STATUS_CLASS = {
  awaiting_confirmation: 'bg-amber-100 text-amber-800',
  awaiting_payment: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-sky-100 text-sky-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

export function sellerOrderActions(status, onHold = false) {
  if (onHold) return []
  if (status === 'awaiting_confirmation') return ['confirm', 'reject']
  if (status === 'processing') return ['ship', 'cancel_item']
  if (status === 'shipped') return ['mark_delivered']
  return []
}
