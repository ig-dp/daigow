import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descriptionSource, parseRupiah } from '../app/utils/product-form.mjs'

test('AI draft source records unchanged and edited descriptions', () => {
  assert.equal(descriptionSource('Deskripsi manual', ''), 'manual')
  assert.equal(descriptionSource('Deskripsi AI', 'Deskripsi AI'), 'ai')
  assert.equal(descriptionSource('Deskripsi AI diedit', 'Deskripsi AI'), 'ai_edited')
})

test('rupiah parser accepts whole non-negative amounts only', () => {
  assert.equal(parseRupiah('0'), 0)
  assert.equal(parseRupiah('125000'), 125000)
  assert.equal(parseRupiah('12.5'), null)
  assert.equal(parseRupiah('-1'), null)
  assert.equal(parseRupiah(''), null)
})
