import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ORDER_STATUS, sellerOrderActions } from '../app/utils/seller-order-status.mjs'

test('all PRD order statuses have a seller-facing label', () => {
  assert.deepEqual(Object.keys(ORDER_STATUS), [
    'awaiting_confirmation', 'awaiting_payment', 'processing', 'shipped',
    'delivered', 'completed', 'cancelled'
  ])
  for (const status of Object.values(ORDER_STATUS)) assert.ok(status.label && status.description)
})

test('seller actions follow lifecycle and disappear while an issue is on hold', () => {
  assert.deepEqual(sellerOrderActions('awaiting_confirmation'), ['confirm', 'reject'])
  assert.deepEqual(sellerOrderActions('processing'), ['ship', 'cancel_item'])
  assert.deepEqual(sellerOrderActions('shipped'), ['mark_delivered'])
  for (const status of ['awaiting_payment', 'delivered', 'completed', 'cancelled']) {
    assert.deepEqual(sellerOrderActions(status), [])
  }
  for (const status of Object.keys(ORDER_STATUS)) assert.deepEqual(sellerOrderActions(status, true), [])
})
