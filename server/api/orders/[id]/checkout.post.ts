import { readBody } from 'h3'
import { apiError } from '../../../utils/api-error'
import { requireOrderAccess } from '../../../utils/order-access'
import { getChannelFee } from '../../../utils/fees'
import { createPaymentRequest } from '../../../utils/xendit'
import { updateOrderPaymentTotals } from '../../../repositories/order.repository'
import { insertPayment } from '../../../repositories/payment.repository'

export default defineEventHandler(async (event) => {
  const order = await requireOrderAccess(event, getRouterParam(event, 'id')!)
  const orderId = order.id
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw apiError(400, 'INVALID_INPUT', 'Body must be a JSON object')
  if (body.method !== 'va' && body.method !== 'qris') throw apiError(400, 'INVALID_INPUT', 'method must be "va" or "qris"')
  const channelCode = body.method === 'va' ? (body.channel_code === 'BCA' ? 'BCA_VIRTUAL_ACCOUNT' : (body.channel_code ?? 'BCA_VIRTUAL_ACCOUNT')) : 'QRIS'

  if (order.status !== 'awaiting_payment' || new Date() >= new Date(order.payment_deadline)) throw apiError(409, 'INVALID_STATE', 'Order is not awaiting payment')

  const channelFee = getChannelFee(body.method, channelCode, order.total_amount)
  if (channelFee === null) throw apiError(400, 'INVALID_INPUT', `Unsupported channel_code for ${body.method}`)

  const amount = order.total_amount + channelFee
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  let providerResponse: any
  try {
    providerResponse = await createPaymentRequest({
      reference_id: orderId,
      type: 'PAY',
      country: 'ID',
      currency: 'IDR',
      request_amount: amount,
      channel_code: channelCode,
      channel_properties: {
        expires_at: expiresAt,
        ...(body.method === 'va' ? { display_name: order.buyer_name } : {}),
      },
    })
  } catch (err) {
    console.error('Xendit createPaymentRequest failed:', (err as Error).message)
    throw apiError(502, 'PAYMENT_PROVIDER_ERROR', 'Failed to create payment with provider')
  }

  const paymentRequestId = providerResponse?.payment_request_id ?? providerResponse?.id
  if (typeof paymentRequestId !== 'string' || !paymentRequestId) {
    console.error('Xendit response did not contain a payment request id:', providerResponse)
    throw apiError(502, 'PAYMENT_PROVIDER_ERROR', 'Payment provider returned an invalid response')
  }

  const { data: payment, error: paymentError } = await insertPayment(event, {
    order_id: orderId,
    payment_method: body.method,
    channel_code: channelCode,
    channel_fee_amount: channelFee,
    amount,
    xendit_payment_request_id: paymentRequestId,
    status: 'pending',
    expires_at: expiresAt,
  })
  if (paymentError || !payment) { console.error('insertPayment failed:', paymentError?.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to create payment') }

  const { error: updateError } = await updateOrderPaymentTotals(event, orderId, channelFee, amount)
  if (updateError) { console.error('updateOrderPaymentTotals failed:', updateError.message); throw apiError(500, 'INTERNAL_ERROR', 'Failed to update order totals') }

  return { payment: { id: payment.id, status: payment.status, amount, expires_at: expiresAt, provider: providerResponse } }
})
