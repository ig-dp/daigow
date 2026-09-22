# Orders Jastiper API Design

**Goal:** Add seller order management and item cancellation APIs.

**Scope:** `GET /api/seller/orders`, `GET /api/seller/orders/:id`, confirm, reject, cancel item, ship, and mark-delivered endpoints.

**Architecture:** Thin Nitro handlers validate input and state; `order.repository.ts` performs service-role queries. Ownership follows `orders -> trips.jastiper_id` or `order_items -> orders -> trips.jastiper_id`. Direct sequential writes are used for cancellation/refund; Supabase RPC is deferred until payment/refund flows need transactional guarantees.

## Endpoints

- `GET /api/seller/orders`: seller/admin; list own-trip orders, optional `trip_id` and `status` filters, newest first.
- `GET /api/seller/orders/:id`: seller/admin owner; return order and items.
- `POST /api/seller/orders/:id/confirm`: only `awaiting_confirmation`; set `status=awaiting_payment`, `confirmed_at=now`, `payment_deadline=now+48h`.
- `POST /api/seller/orders/:id/reject`: only `awaiting_confirmation`; body `{ reason }`, non-empty; set `status=cancelled`, `cancellation_reason`, `cancelled_by=jastiper`.
- `POST /api/seller/order-items/:id/cancel`: only order `processing`; set item cancelled. Remaining active items create `partial_item` refund. Last active item creates `full_order` refund with full platform fee and cancels the order.
- `POST /api/seller/orders/:id/ship`: only `processing`; body has `shipping_evidence_url?` or `tracking_number?`, at least one non-empty; set `status=shipped`, fields, `shipped_at`.
- `POST /api/seller/orders/:id/mark-delivered`: only `shipped`; set `status=delivered`, `delivered_by=jastiper`, `delivered_at=now`, `auto_complete_at=now+72h`.

All endpoints return standard `{ error: { code, message } }`. Non-owned resources return 404. Invalid status returns 409. Email calls use the existing console stub and cannot fail the request.

## Refund rules

Refund rows use `status=pending_transfer`, `channel_fee_refunded=0`.
- Partial: `refund_type=partial_item`, `item_amount_refunded=item.line_total`, `platform_fee_refunded=0`, order remains processing.
- Last active item: `refund_type=full_order`, item amount equals cancelled item line total, platform fee refund equals full order platform fee, order becomes cancelled and `cancelled_by=jastiper`.

## Verification

Add pure state-transition, shipping-input, and refund-calculation tests to `tests/profile-api.test.mjs`. Run `npm test` and `npm run build`. No commit unless explicitly requested.
