import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adminCancelRefund } from '../shared/utils/refund-amount.mjs'

// Reference order: A 600000 + B 400000, platform fee 15000.
const order = (bStatus) => ({
  platform_fee_amount: 15000,
  order_items: [
    { line_total: 600000, item_status: 'active' },
    { line_total: 400000, item_status: bStatus }
  ]
})

test('admin cancel refunds all items plus platform fee (AC-7.4)', () => {
  assert.deepEqual(adminCancelRefund(order('active')), { item_amount_refunded: 1000000, platform_fee_refunded: 15000, total_refund_amount: 1015000 })
})

test('admin cancel skips items already refunded, keeping the ceiling (AC-7.5)', () => {
  const refund = adminCancelRefund(order('cancelled'))
  assert.equal(refund.total_refund_amount, 615000)
  assert.equal(400000 + refund.total_refund_amount, 1000000 + 15000)
})
