# API Reference: Daigow (Training Edition)

> Business rules: [`PRD.md`](./PRD.md). Entities: [`DATA_MODEL.md`](./DATA_MODEL.md).

## Conventions
- All routes are Nitro routes under `server/api/`
- **Auth labels:**
  - **Public** — no auth
  - **Jastiper (owner)** — session with `role = jastiper` and owns the resource
  - **Buyer (order)** — session user is `Order.buyer_id` **or** header `X-Tracking-Token` matches the Order
  - **Admin** — session with `role = admin`
  - **System** — secret header or signature
- Money in IDR, whole rupiah
- Errors: `{ error: { code: string, message: string } }`
- Invalid state transition → `409 { code: "INVALID_STATE" }`

---

## 1. Auth & Profile
Signup/login via Supabase Auth client SDK.

| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/me` | Any session | Current profile incl. role |
| `PATCH /api/me` | Any session | Update name, phone (never `role`) |
| `POST /api/me/become-jastiper` | Session with `role = buyer` | Body `{ code }`. Constant-time compare with `JASTIPER_INVITE_CODE`; on match sets `role = jastiper`. Wrong code → 403 `INVALID_INVITE_CODE`. Already Jastiper/admin → 409. Rate limit: 5 attempts per user per hour → 429 |
| `GET /api/seller/payout-account` | Jastiper | Read own payout account |
| `PUT /api/seller/payout-account` | Jastiper | Upsert `bank_code`, `account_number`, `account_holder_name` |

## 2. Trips
| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/trips/by-slug/:slug` | Public | Trip detail. If `coming_soon`, products omitted. If `open`/`closed`, includes products, photos, variants. Supports `q`, `min_price`, `max_price` filtering of products |
| `POST /api/trips/:id/subscribe` | Public | Body `{ email }`. Only while `coming_soon`. Idempotent per email |
| `GET /api/seller/trips` | Jastiper | Own Trips |
| `POST /api/seller/trips` | Jastiper | Create: `title`, `destination`, `description?`, `thumbnail_url`, `order_open_at`, `order_close_at`. Starts as `coming_soon`; slug generated |
| `PATCH /api/seller/trips/:id` | Jastiper (owner) | Edit fields. Blocked when `closed` |
| `POST /api/seller/trips/:id/open` | Jastiper (owner) | `coming_soon` → `open`. Emails subscribers with `notified_at` null |
| `POST /api/seller/trips/:id/close` | Jastiper (owner) | `open` → `closed` |

## 3. Products
| Method & Path | Auth | Purpose |
|---|---|---|
| `POST /api/seller/trips/:tripId/products` | Jastiper (owner) | Create: `name`, `category?`, `description?`, `description_source`, `price`, `photos[]` (`{ photo_url, sort_order }`), `variants[]?` (`{ name, photo_url?, price }`) |
| `GET /api/seller/products/:id` | Jastiper (owner) | Load one product with photos and variants for editing |
| `PATCH /api/seller/products/:id` | Jastiper (owner) | Edit fields; replaces photos/variants arrays if provided. Existing variants may include `id` to preserve references; a variant used by an order cannot be removed |
| `DELETE /api/seller/products/:id` | Jastiper (owner) | Rejected with 409 if referenced by any OrderItem |
| `POST /api/ai/product-description` | Jastiper | Body `{ name, photo_url, category? }` → `{ description }`. Never writes DB. Rate-limited |

Photo files are uploaded directly to Supabase Storage; routes receive URLs only.

## 4. Orders — Buyer
| Method & Path | Auth | Purpose |
|---|---|---|
| `POST /api/orders` | Public (session optional) | Body: `trip_id`, `items[]` (`{ product_id, variant_id?, quantity }`), `buyer_name`, `buyer_email`, `buyer_phone`, `shipping_address`. Validates Trip is `open` and within window; variant required if product has variants. Computes prices, fees (snapshot rates), snapshots. Returns `{ order_id, tracking_token }`. Emails buyer (tracking link) and Jastiper |
| `GET /api/orders/track/:token` | Public (token in path) | Order detail for the tracking page |
| `GET /api/me/orders` | Session | Registered buyer's orders |
| `POST /api/orders/:id/checkout` | Buyer (order) | Body `{ method: "va" \| "qris", channel_code? }`. Requires `awaiting_payment` and before `payment_deadline`. Computes channel fee, updates totals, creates Xendit Payment Request, returns normalized payment instructions |
| `POST /api/orders/:id/mark-delivered` | Buyer (order) | `shipped` → `delivered` (`delivered_by = buyer`) |
| `POST /api/orders/:id/confirm-received` | Buyer (order) | `delivered` → `completed`, not allowed while on hold. Triggers payout |
| `POST /api/orders/:id/report-issue` | Buyer (order) | Body `{ note }`. Allowed in `processing`/`shipped`/`delivered`, only if never reported before. Sets on hold, emails admin + Jastiper |

## 5. Orders — Jastiper
| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/seller/orders` | Jastiper | Orders across own Trips; filter by `trip_id`, `status` |
| `GET /api/seller/orders/:id` | Jastiper (owner) | Detail including lifecycle fields, payout status, and refunds |
| `POST /api/seller/orders/:id/confirm` | Jastiper (owner) | `awaiting_confirmation` → `awaiting_payment`; sets `payment_deadline`. Emails buyer |
| `POST /api/seller/orders/:id/reject` | Jastiper (owner) | Body `{ reason }` (required, non-empty). → `cancelled`. Emails buyer with reason |
| `POST /api/seller/order-items/:id/cancel` | Jastiper (owner) | Order must be `processing`. Item → `cancelled`. If other active items remain → `partial_item` Refund for this item. If this was the last active item → no partial Refund; instead one `full_order` Refund (this item + full platform fee) and order `cancelled` (AC-7.3). Emails buyer |
| `POST /api/seller/orders/:id/ship` | Jastiper (owner) | Body `{ shipping_evidence_url?, tracking_number? }` — at least one required. `processing` → `shipped` |
| `POST /api/seller/orders/:id/mark-delivered` | Jastiper (owner) | `shipped` → `delivered` (`delivered_by = jastiper`). Emails buyer |

Seller shipping, delivery, and item cancellation actions return `409` while an unresolved buyer issue places the order on hold. Confirmation and rejection return `409` after the confirmation deadline.

## 6. Admin
| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/admin/orders?on_hold=true` | Admin | Orders with unresolved issues |
| `GET /api/admin/orders/:id` | Admin | Full detail incl. payments, refunds, payout, evidence (signed URL) |
| `POST /api/admin/orders/:id/release` | Admin | On-hold order in `shipped`/`delivered` → `completed` (`completed_by = admin`), `issue_resolution = released`. Triggers payout |
| `POST /api/admin/orders/:id/cancel` | Admin | Body `{ reason }`. On-hold order → `cancelled`, `issue_resolution = cancelled`, creates `admin_cancel` Refund (if paid) |
| `GET /api/admin/refunds?status=pending_transfer` | Admin | Refunds awaiting manual transfer, with buyer contact |
| `POST /api/admin/refunds/:id/mark-transferred` | Admin | Body `{ transfer_reference }`. Emails buyer |
| `GET /api/admin/payouts?status=failed` | Admin | Failed payouts |
| `POST /api/admin/payouts/:id/retry` | Admin | Re-reads PayoutAccount, increments `attempt`, new idempotency key |
| `GET /api/admin/payments/orphaned` | Admin | Paid webhooks received for orders no longer awaiting payment (need manual refund) |

## 7. System
| Method & Path | Auth | Purpose |
|---|---|---|
| `POST /api/webhooks/xendit` | Xendit callback token | Payment succeeded/failed/expired and payout succeeded/failed. Idempotent via `WebhookEvent.event_id` |
| `POST /api/cron/process-deadlines` | `CRON_SECRET` header | Confirmation timeout, payment timeout, auto-complete (skips on-hold) |
