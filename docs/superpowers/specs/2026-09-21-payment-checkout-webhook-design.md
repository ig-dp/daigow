# Payment Checkout and Xendit Webhook Design

**Goal:** Add buyer checkout and idempotent Xendit payment callbacks.

**Scope:** `POST /api/orders/:id/checkout` and `POST /api/webhooks/xendit`, plus payment/webhook repositories and pure tests.

**Architecture:** Thin Nitro handlers validate auth, input, lifecycle, and provider token. Repositories perform service-role Supabase queries. Checkout calls Xendit Payment Request API v3, stores a pending `payments` row, and snapshots channel fees. Webhook inserts `webhook_events` before mutation, then updates payment/order state.

## Checkout

- Authenticated buyer only for MVP; buyer ownership is `orders.buyer_id = user.id`.
- Requires order status `awaiting_payment` and current time before `payment_deadline`.
- Body: `{ method: "va" | "qris", channel_code?: string }`.
- `va` requires supported channel code (`BCA` for MVP); `qris` uses `QRIS`.
- Channel fees: BCA VA flat `4000`; QRIS `Math.round(amount * 0.007)`.
- Charge amount: `order.total_amount + channel_fee_amount`.
- Call Xendit `POST /v3/payment_requests` with `XENDIT_SECRET_KEY`.
- Store `payments`: order ID, method, channel, fee, amount, Xendit request ID, pending status, expiry.
- Update order channel fee and total amount.
- Return normalized payment ID, amount, expiry, and provider instructions.
- Provider errors return `502 PAYMENT_PROVIDER_ERROR`; no payment row is persisted when provider creation fails.

## Webhook

- Route: `POST /api/webhooks/xendit`.
- Require `x-callback-token` equal to `XENDIT_WEBHOOK_TOKEN`; invalid/missing token returns `401 INVALID_WEBHOOK_TOKEN`.
- Extract provider event ID, event type, payment request ID, status, paid timestamp, and raw payload.
- Insert `webhook_events` first with provider `xendit`; unique event conflict returns `200 { received: true, duplicate: true }`.
- Match payment by `xendit_payment_request_id`; unknown payment is recorded and returns `200`.
- Success: payment `paid`, `paid_at`; if order is `awaiting_payment`, update order to `processing`.
- Failed/expired: update payment status only.
- Payment already paid or order outside `awaiting_payment`: preserve state, return success; admin can inspect orphan events later.
- Always return `200 { received: true }` after valid-token processing to prevent provider retries for business-state mismatches.

## Errors

- Standard `{ error: { code, message } }`.
- `401 INVALID_WEBHOOK_TOKEN`, `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `404 ORDER_NOT_FOUND`, `409 INVALID_STATE`, `502 PAYMENT_PROVIDER_ERROR`, `500 INTERNAL_ERROR`.

## Verification

Add pure tests to `tests/profile-api.test.mjs` for channel fees, checkout lifecycle/deadline, webhook token, duplicate event, success transition, failed/expired transition, and orphan payment. Run `npm test` and `npm run build`. No commit unless explicitly requested.
