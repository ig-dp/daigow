import { readBody } from 'h3'
import { apiError } from '../../../utils/api-error'
import { requireOrderAccess } from '../../../utils/order-access'
import { reportOrderIssue } from '../../../repositories/order.repository'
import { sendEmail } from '../../../utils/mailer'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body.note !== 'string' || !body.note.trim()) throw apiError(400, 'INVALID_INPUT', 'note is required')
  const order = await requireOrderAccess(event, getRouterParam(event, 'id')!)
  if (!['processing', 'shipped', 'delivered'].includes(order.status) || order.issue_reported_at) throw apiError(409, 'INVALID_STATE', 'Order cannot accept an issue')
  const { data, error } = await reportOrderIssue(event, order.id, body.note.trim())
  if (error || !data) throw apiError(409, 'INVALID_STATE', 'Order cannot accept an issue')
  if (order.buyer_email) sendEmail(order.buyer_email, 'Issue laporan diterima', 'Laporan pesanan Anda sedang ditinjau.')
  return { order: data }
})
