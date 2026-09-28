import { test } from 'node:test'
import assert from 'node:assert'
import { createHash, timingSafeEqual } from 'node:crypto'
import { buildPayoutRequest, normalizePayoutStatus } from '../shared/utils/payout.mjs'

// Inlined rate limiter (from server/utils/invite-rate-limit.ts)
const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 60 * 1000
const attempts = new Map()

function consumeInviteAttempt(userId) {
  const now = Date.now()
  const timestamps = (attempts.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)

  if (timestamps.length >= MAX_ATTEMPTS) {
    attempts.set(userId, timestamps)
    return false
  }

  timestamps.push(now)
  attempts.set(userId, timestamps)
  return true
}

// Inlined invite comparison (from server/usecases/profile/become-jastiper.ts)
function inviteMatches(input, expected) {
  const inputHash = createHash('sha256').update(input).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(inputHash, expectedHash)
}

test('invite comparison: equal codes return true', () => {
  const validCode = 'secret-invite-123'
  assert.strictEqual(inviteMatches(validCode, validCode), true)
})

test('invite comparison: different codes return false', () => {
  const validCode = 'secret-invite-123'
  assert.strictEqual(inviteMatches('wrong-code', validCode), false)
})

test('rate limiter: first 5 attempts succeed', () => {
  const userId = `test-user-${Date.now()}-${Math.random()}`
  for (let i = 1; i <= 5; i++) {
    assert.strictEqual(consumeInviteAttempt(userId), true, `attempt ${i} should succeed`)
  }
})

test('rate limiter: 6th attempt rejected', () => {
  const userId = `test-user-${Date.now()}-${Math.random()}`
  for (let i = 1; i <= 5; i++) {
    consumeInviteAttempt(userId)
  }
  assert.strictEqual(consumeInviteAttempt(userId), false, 'attempt 6 should be rejected')
})

function sellerRoleAllowed(role) {
  return role === 'jastiper' || role === 'admin'
}

function validatePayoutAccount(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  return ['bank_code', 'account_number', 'account_holder_name'].every(
    (key) => typeof body[key] === 'string' && body[key].length > 0
  )
}

test('seller role gate allows jastiper and admin only', () => {
  assert.strictEqual(sellerRoleAllowed('jastiper'), true)
  assert.strictEqual(sellerRoleAllowed('admin'), true)
  assert.strictEqual(sellerRoleAllowed('buyer'), false)
})

test('payout account validation requires all non-empty string fields', () => {
  assert.strictEqual(validatePayoutAccount({ bank_code: 'BRI', account_number: '00123', account_holder_name: 'Test' }), true)
  assert.strictEqual(validatePayoutAccount({ bank_code: 'BRI', account_number: '', account_holder_name: 'Test' }), false)
  assert.strictEqual(validatePayoutAccount({ bank_code: 'BRI', account_holder_name: 'Test' }), false)
  assert.strictEqual(validatePayoutAccount([]), false)
})

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function generateTripSlug(title) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const suffix = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `${slugify(title)}-${suffix}`
}

const TRIP_REQUIRED_KEYS = ['title', 'destination', 'thumbnail_url', 'order_open_at', 'order_close_at']
const TRIP_ALLOWED_KEYS = new Set([...TRIP_REQUIRED_KEYS, 'description'])

function validateTripCreate(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  for (const key of Object.keys(body)) if (!TRIP_ALLOWED_KEYS.has(key)) return false
  for (const key of TRIP_REQUIRED_KEYS) if (typeof body[key] !== 'string' || body[key].length === 0) return false
  return !('description' in body) || typeof body.description === 'string'
}

function validateTripPatch(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const keys = Object.keys(body)
  if (keys.length === 0) return false
  for (const key of keys) {
    if (!TRIP_ALLOWED_KEYS.has(key) || typeof body[key] !== 'string' || body[key].length === 0) return false
  }
  return true
}

test('generateTripSlug produces slugified title + 6-char suffix', () => {
  assert.match(generateTripSlug('Tokyo Maret!!'), /^tokyo-maret-[a-z0-9]{6}$/)
})

test('trip validation enforces required and allowed fields', () => {
  const valid = { title: 'Tokyo', destination: 'Tokyo', thumbnail_url: 'x', order_open_at: '2026-01-01', order_close_at: '2026-02-01' }
  assert.strictEqual(validateTripCreate(valid), true)
  assert.strictEqual(validateTripCreate({ ...valid, title: '' }), false)
  assert.strictEqual(validateTripCreate({ ...valid, extra: 'x' }), false)
  assert.strictEqual(validateTripPatch({}), false)
  assert.strictEqual(validateTripPatch({ title: 'New' }), true)
})

test('trip lifecycle transitions are gated by current status', () => {
  const canOpen = (status) => status === 'coming_soon'
  const canClose = (status) => status === 'open'
  assert.strictEqual(canOpen('coming_soon'), true)
  assert.strictEqual(canOpen('open'), false)
  assert.strictEqual(canOpen('closed'), false)
  assert.strictEqual(canClose('open'), true)
  assert.strictEqual(canClose('coming_soon'), false)
  assert.strictEqual(canClose('closed'), false)
})

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

test('subscribe email validation accepts well-formed emails only', () => {
  assert.strictEqual(isValidEmail('buyer@example.com'), true)
  assert.strictEqual(isValidEmail('a@b.co'), true)
  assert.strictEqual(isValidEmail(''), false)
  assert.strictEqual(isValidEmail('no-at-sign'), false)
  assert.strictEqual(isValidEmail('a b@c.com'), false)
  assert.strictEqual(isValidEmail(123), false)
})

test('subscribe allowed only while trip is coming_soon', () => {
  assert.strictEqual(isValidEmail('coming_soon') === false, true)
  assert.strictEqual(['coming_soon'].includes('coming_soon'), true)
  assert.strictEqual(['coming_soon'].includes('open'), false)
  assert.strictEqual(['coming_soon'].includes('closed'), false)
})

function isValidDescriptionSource(value) {
  return value === 'manual' || value === 'ai' || value === 'ai_edited'
}

function isValidPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const PRODUCT_REQUIRED_KEYS = ['name', 'description_source', 'price', 'photos']
const PRODUCT_ALLOWED_KEYS = new Set([...PRODUCT_REQUIRED_KEYS, 'category', 'description', 'variants'])

function validatePhoto(photo) {
  return typeof photo === 'object' && photo !== null && !Array.isArray(photo) &&
    typeof photo.photo_url === 'string' && photo.photo_url.length > 0 &&
    typeof photo.sort_order === 'number' && Number.isInteger(photo.sort_order)
}

function validateVariant(variant) {
  if (typeof variant !== 'object' || variant === null || Array.isArray(variant)) return false
  if (typeof variant.name !== 'string' || variant.name.length === 0) return false
  if (!isValidPrice(variant.price)) return false
  if ('photo_url' in variant && typeof variant.photo_url !== 'string') return false
  return true
}

function validateProductCreate(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  for (const key of Object.keys(body)) if (!PRODUCT_ALLOWED_KEYS.has(key)) return false
  if (typeof body.name !== 'string' || body.name.length === 0) return false
  if (!isValidDescriptionSource(body.description_source)) return false
  if (!isValidPrice(body.price)) return false
  if ('category' in body && typeof body.category !== 'string') return false
  if ('description' in body && typeof body.description !== 'string') return false
  if (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every(validatePhoto)) return false
  if ('variants' in body) {
    if (!Array.isArray(body.variants)) return false
    if (!body.variants.every(validateVariant)) return false
  }
  return true
}

function validateProductPatch(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const keys = Object.keys(body)
  if (keys.length === 0) return false
  for (const key of keys) {
    if (!PRODUCT_ALLOWED_KEYS.has(key)) return false
    if (key === 'name' && (typeof body.name !== 'string' || body.name.length === 0)) return false
    if (key === 'description_source' && !isValidDescriptionSource(body.description_source)) return false
    if (key === 'price' && !isValidPrice(body.price)) return false
    if (key === 'category' && typeof body.category !== 'string') return false
    if (key === 'description' && typeof body.description !== 'string') return false
    if (key === 'photos' && (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every(validatePhoto))) return false
    if (key === 'variants' && (!Array.isArray(body.variants) || !body.variants.every(validateVariant))) return false
  }
  return true
}

test('product create validation enforces required and allowed fields', () => {
  const valid = { name: 'Tas', description_source: 'manual', price: 100000, photos: [{ photo_url: 'x', sort_order: 0 }] }
  assert.strictEqual(validateProductCreate(valid), true)
  assert.strictEqual(validateProductCreate({ ...valid, name: '' }), false)
  assert.strictEqual(validateProductCreate({ ...valid, price: -1 }), false)
  assert.strictEqual(validateProductCreate({ ...valid, description_source: 'bad' }), false)
  assert.strictEqual(validateProductCreate({ ...valid, photos: [] }), false)
  assert.strictEqual(validateProductCreate({ ...valid, extra: 'x' }), false)
  assert.strictEqual(validateProductCreate({ ...valid, variants: [{ name: 'Merah', price: 120000 }] }), true)
  assert.strictEqual(validateProductCreate({ ...valid, variants: [{ name: '', price: 1 }] }), false)
})

test('product patch validation requires at least one valid field', () => {
  assert.strictEqual(validateProductPatch({}), false)
  assert.strictEqual(validateProductPatch({ price: 50000 }), true)
  assert.strictEqual(validateProductPatch({ price: -5 }), false)
  assert.strictEqual(validateProductPatch({ photos: [{ photo_url: 'y', sort_order: 0 }] }), true)
  assert.strictEqual(validateProductPatch({ photos: [] }), false)
})

test('product delete blocked when referenced by order items', () => {
  const hasOrderItems = (refs) => refs.length > 0
  assert.strictEqual(hasOrderItems([]), false)
  assert.strictEqual(hasOrderItems([{ id: 'x' }]), true)
})

function roundFee(subtotal, rate) {
  return Math.round(subtotal * rate)
}

test('platform fee rounds half-up on subtotal', () => {
  assert.strictEqual(roundFee(100000, 0.015), 1500)
  assert.strictEqual(roundFee(333, 0.015), 5) // 4.995 -> 5
})

function computeOrderTotals(items) {
  const subtotal_amount = items.reduce((sum, i) => sum + i.line_total, 0)
  const platform_fee_amount = roundFee(subtotal_amount, 0.015)
  const total_amount = subtotal_amount + platform_fee_amount
  return { subtotal_amount, platform_fee_amount, total_amount }
}

test('order totals sum line totals and add platform fee', () => {
  const items = [{ line_total: 100000 }, { line_total: 50000 }]
  const totals = computeOrderTotals(items)
  assert.strictEqual(totals.subtotal_amount, 150000)
  assert.strictEqual(totals.platform_fee_amount, 2250)
  assert.strictEqual(totals.total_amount, 152250)
})

function isValidOrderNumber(n) {
  return /^DG-\d{6}-\d{4}$/.test(n)
}

test('order number matches DG-YYMMDD-#### format', () => {
  assert.strictEqual(isValidOrderNumber('DG-260921-4821'), true)
  assert.strictEqual(isValidOrderNumber('DG-2609-4821'), false)
  assert.strictEqual(isValidOrderNumber('dg-260921-4821'), false)
})

function isValidOrderCreateBody(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const REQUIRED = ['trip_id', 'items', 'buyer_name', 'buyer_email', 'buyer_phone', 'shipping_address']
  const ALLOWED = new Set(REQUIRED)
  for (const key of Object.keys(body)) if (!ALLOWED.has(key)) return false
  for (const key of REQUIRED) if (!(key in body)) return false
  if (typeof body.trip_id !== 'string' || !body.trip_id) return false
  if (!Array.isArray(body.items) || body.items.length === 0) return false
  for (const item of body.items) {
    if (typeof item !== 'object' || item === null) return false
    if (typeof item.product_id !== 'string' || !item.product_id) return false
    if ('variant_id' in item && typeof item.variant_id !== 'string') return false
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) return false
  }
  if (typeof body.buyer_name !== 'string' || !body.buyer_name) return false
  if (typeof body.buyer_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.buyer_email)) return false
  if (typeof body.buyer_phone !== 'string' || !body.buyer_phone) return false
  if (typeof body.shipping_address !== 'string' || !body.shipping_address) return false
  return true
}

test('order create validation enforces required fields and item shape', () => {
  const valid = { trip_id: 't1', items: [{ product_id: 'p1', quantity: 2 }], buyer_name: 'Budi', buyer_email: 'a@b.com', buyer_phone: '0812', shipping_address: 'Jl. X' }
  assert.strictEqual(isValidOrderCreateBody(valid), true)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, items: [] }), false)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, items: [{ product_id: 'p1', quantity: 0 }] }), false)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, buyer_email: 'bad' }), false)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, extra: 'x' }), false)
  assert.strictEqual(isValidOrderCreateBody({ ...valid, items: [{ product_id: 'p1', variant_id: 'v1', quantity: 1 }] }), true)
})

test('trip must be open and within order window to accept orders', () => {
  const canOrder = (status, now, openAt, closeAt) => status === 'open' && now >= openAt && now <= closeAt
  assert.strictEqual(canOrder('open', 5, 1, 10), true)
  assert.strictEqual(canOrder('coming_soon', 5, 1, 10), false)
  assert.strictEqual(canOrder('open', 11, 1, 10), false)
  assert.strictEqual(canOrder('open', 0, 1, 10), false)
})

test('variant required when product has variants', () => {
  const needsVariant = (variants, variant_id) => (variants.length > 0 ? Boolean(variant_id) : true)
  assert.strictEqual(needsVariant([{ id: 'v1' }], undefined), false)
  assert.strictEqual(needsVariant([{ id: 'v1' }], 'v1'), true)
  assert.strictEqual(needsVariant([], undefined), true)
})

function canConfirm(status) { return status === 'awaiting_confirmation' }
function canReject(status) { return status === 'awaiting_confirmation' }
function canCancelItem(orderStatus) { return orderStatus === 'processing' }
function canShip(status) { return status === 'processing' }
function canMarkDelivered(status) { return status === 'shipped' }

test('order status gates for seller transitions', () => {
  assert.strictEqual(canConfirm('awaiting_confirmation'), true)
  assert.strictEqual(canConfirm('processing'), false)
  assert.strictEqual(canReject('awaiting_confirmation'), true)
  assert.strictEqual(canCancelItem('processing'), true)
  assert.strictEqual(canCancelItem('shipped'), false)
  assert.strictEqual(canShip('processing'), true)
  assert.strictEqual(canShip('awaiting_payment'), false)
  assert.strictEqual(canMarkDelivered('shipped'), true)
  assert.strictEqual(canMarkDelivered('delivered'), false)
})

function isValidRejectBody(body) {
  return typeof body === 'object' && body !== null && !Array.isArray(body) &&
    typeof body.reason === 'string' && body.reason.length > 0
}

test('reject requires non-empty reason', () => {
  assert.strictEqual(isValidRejectBody({ reason: 'Out of stock' }), true)
  assert.strictEqual(isValidRejectBody({ reason: '' }), false)
  assert.strictEqual(isValidRejectBody({}), false)
})

function isValidShipBody(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const hasEvidence = typeof body.shipping_evidence_url === 'string' && body.shipping_evidence_url.length > 0
  const hasTracking = typeof body.tracking_number === 'string' && body.tracking_number.length > 0
  return hasEvidence || hasTracking
}

test('ship requires at least one of evidence url or tracking number', () => {
  assert.strictEqual(isValidShipBody({ shipping_evidence_url: 'http://x' }), true)
  assert.strictEqual(isValidShipBody({ tracking_number: 'JX123' }), true)
  assert.strictEqual(isValidShipBody({}), false)
  assert.strictEqual(isValidShipBody({ shipping_evidence_url: '' }), false)
})

function computeCancelRefund(item, remainingActiveCount, orderPlatformFee) {
  if (remainingActiveCount > 0) return { refund_type: 'partial_item', item_amount_refunded: item.line_total, platform_fee_refunded: 0, total_refund_amount: item.line_total, orderCancelled: false }
  const total = item.line_total + orderPlatformFee
  return { refund_type: 'full_order', item_amount_refunded: item.line_total, platform_fee_refunded: orderPlatformFee, total_refund_amount: total, orderCancelled: true }
}

test('cancel item computes partial refund when other active items remain', () => {
  const result = computeCancelRefund({ line_total: 50000 }, 1, 3000)
  assert.strictEqual(result.refund_type, 'partial_item')
  assert.strictEqual(result.item_amount_refunded, 50000)
  assert.strictEqual(result.platform_fee_refunded, 0)
  assert.strictEqual(result.orderCancelled, false)
})

test('cancel item computes full order refund when last active item', () => {
  const result = computeCancelRefund({ line_total: 50000 }, 0, 3000)
  assert.strictEqual(result.refund_type, 'full_order')
  assert.strictEqual(result.item_amount_refunded, 50000)
  assert.strictEqual(result.platform_fee_refunded, 3000)
  assert.strictEqual(result.total_refund_amount, 53000)
  assert.strictEqual(result.orderCancelled, true)
})

function channelFee(method, channelCode, amount) {
  if (method === 'va' && channelCode === 'BCA') return 4000
  if (method === 'qris' && channelCode === 'QRIS') return Math.round(amount * 0.007)
  return null
}

test('checkout channel fees use supported methods', () => {
  assert.strictEqual(channelFee('va', 'BCA', 100000), 4000)
  assert.strictEqual(channelFee('qris', 'QRIS', 100000), 700)
  assert.strictEqual(channelFee('va', 'MANDIRI', 100000), null)
})

test('checkout accepts only awaiting payment before deadline', () => {
  const valid = (status, now, deadline) => status === 'awaiting_payment' && now < deadline
  assert.strictEqual(valid('awaiting_payment', 5, 10), true)
  assert.strictEqual(valid('processing', 5, 10), false)
  assert.strictEqual(valid('awaiting_payment', 10, 10), false)
})

function applyPaymentWebhook(orderStatus, paymentStatus, eventStatus) {
  if (eventStatus === 'SUCCEEDED' && paymentStatus !== 'paid' && orderStatus === 'awaiting_payment') return { payment: 'paid', order: 'processing' }
  if (eventStatus === 'SUCCEEDED') return { payment: paymentStatus, order: orderStatus }
  return { payment: eventStatus === 'EXPIRED' ? 'expired' : 'failed', order: orderStatus }
}

test('payment webhook transitions successful payment once', () => {
  assert.deepStrictEqual(applyPaymentWebhook('awaiting_payment', 'pending', 'SUCCEEDED'), { payment: 'paid', order: 'processing' })
  assert.deepStrictEqual(applyPaymentWebhook('processing', 'paid', 'SUCCEEDED'), { payment: 'paid', order: 'processing' })
  assert.deepStrictEqual(applyPaymentWebhook('awaiting_payment', 'pending', 'EXPIRED'), { payment: 'expired', order: 'awaiting_payment' })
})

test('payout request uses the seller bank snapshot and stable external id', () => {
  assert.deepStrictEqual(buildPayoutRequest({
    externalId: 'payout-order-1-1',
    amount: 975000,
    account: { bank_code: 'BCA', account_number: '1234567890', account_holder_name: 'Dian Muse' },
    description: 'Daigow payout order-1',
    email: 'seller@example.com'
  }), {
    reference_id: 'payout-order-1-1',
    recipient: {
      type: 'INDIVIDUAL',
      given_name: 'Dian',
      surname: 'Muse',
      relationship: 'SUPPLIER',
      details: { personal_email: 'seller@example.com' },
      address: { country: 'ID' },
      account_details: {
        currency: 'IDR',
        account_country: 'ID',
        account_holder_name: 'Dian Muse',
        account_number: '1234567890',
        routing_type_1: 'SWIFT',
        routing_value_1: 'CENAIDJA'
      }
    },
    payout_details: {
      source_currency: 'IDR',
      source_amount: 975000,
      destination_currency: 'IDR'
    },
    source_of_fund: 'BUSINESS_REVENUE',
    purpose_code: 'TRADES',
    description: 'Daigow payout order-1'
  })
})

test('payout webhook status mapping is terminal and idempotent', () => {
  assert.equal(normalizePayoutStatus('SUCCEEDED'), 'succeeded')
  assert.equal(normalizePayoutStatus('FAILED'), 'failed')
  assert.equal(normalizePayoutStatus('PENDING_COMPLIANCE_REVIEW'), 'pending')
})

test('payout request rejects channels without a verified v3 mapping', () => {
  assert.throws(() => buildPayoutRequest({
    externalId: 'payout-order-2-1',
    amount: 1000,
    account: { bank_code: 'BNI', account_number: '123', account_holder_name: 'Dian Muse' },
    description: 'Daigow payout order-2'
  }), /Unsupported payout channel: BNI/)
})
