# Architecture: Daigow (Training Edition)

> See [`PRD.md`](./PRD.md) and [`DATA_MODEL.md`](./DATA_MODEL.md).

## Context & Constraints
- Solo developer (Nuxt background), AI-assisted, **2-week build**
- Minimize moving parts; every external service must earn its place

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend + Backend | Nuxt 4 (Nitro server routes) | Single codebase and deployment |
| Database | Supabase Postgres | `@nuxtjs/supabase` |
| Auth | Supabase Auth (email/password) | Guests don't authenticate — they use a tracking token |
| File storage | Supabase Storage | Direct browser upload |
| Payments | Xendit Payment Requests API (VA, QRIS) | In-app payment UI, no hosted redirect |
| Payouts | Xendit Payouts API | Automatic payout on completion |
| AI | Google Gemini 2.5 Flash-Lite | Product description drafts. Verify current model id before coding |
| Email | Transactional provider (e.g. Resend) — TBD | Only notification channel |
| Hosting | Vercel Hobby | |
| Scheduler | cron-job.org → one Nitro route | Every 15 min |

## 2. High-Level Flow
```
Browser (Nuxt)
  ├─ Supabase Auth (client SDK) ─────────► login/signup
  ├─ Direct upload ──────────────────────► Supabase Storage
  └─ API calls ──────────────────────────► Nitro (server/api/*)
                                              ├─► Supabase Postgres (service role)
                                              ├─► Xendit (payment requests, payouts)
                                              ├─► Gemini (AI description)
                                              └─► Email provider

cron-job.org (15 min) ──► POST /api/cron/process-deadlines
Xendit ──► POST /api/webhooks/xendit
```

## 3. Frontend
- Vue 3 Composition API, mobile-first
- Direct Supabase reads only for data that is safe under RLS (a Jastiper's own Trips/products). All buyer-facing and order data goes through Nitro, because guest access by token can't be expressed in RLS
- Images compressed client-side before upload (max 1200px, WebP/JPEG ~80%)

Key pages:
- `/t/:slug` — public Trip page (coming-soon + subscribe, or catalog + cart)
- `/checkout` — contact/address form (prefilled for logged-in buyers)
- `/o/:token` — order tracking page (guest and registered)
- `/account/orders` — registered buyer's orders
- `/account` — profile, including the "Punya kode Jastiper?" form
- `/seller/*` — Jastiper dashboard: trips, products, orders, payout account
- `/admin/*` — on-hold orders, pending refunds, failed payouts

## 4. Backend (Nitro)
- Route handlers are thin: validate input → authorize → call pure functions in `server/utils/` → write DB → side effects (Xendit, email)
- **Authorization for buyer actions** accepts either:
  1. a Supabase session whose user is `Order.buyer_id`, or
  2. an `X-Tracking-Token` header matching `Order.tracking_token` (compared in constant time)
- **State transitions are conditional updates**: `UPDATE ... WHERE id = $1 AND status = $expected RETURNING *`. Zero rows → the transition already happened or is invalid → return 409, do no side effects. This is the single mechanism that makes cron, webhooks, and double-clicks safe
- Side effects (email, payout) run only after the conditional update succeeds

## 5. Database & RLS
- RLS enabled on all tables
- Public (anon) can read: Trips with status `coming_soon`/`open`/`closed` by slug, and Products/Photos/Variants of `open`/`closed` Trips
- Jastiper can read/write own Trips, Products, Photos, Variants, PayoutAccount
- Users can update their own profile row except `role` (enforce with a column-level check or trigger); role changes happen only in Nitro with the service role key
- Orders, Payments, Refunds, Payouts, WebhookEvents: **no client access** — only through Nitro with the service role key
- Admin actions go through Nitro routes that check `role = 'admin'` in code

## 6. Storage
Buckets and paths:
- `trips/{jastiper_id}/{trip_id}/cover.*` — public read
- `products/{jastiper_id}/{product_id}/{file}` — public read
- `order-snapshots/{order_item_id}.webp` — public read (unguessable path), written by server only
- `shipping-proof/{order_id}/{file}` — private; served via signed URL through Nitro

Storage RLS restricts writes to the uploader's own `{jastiper_id}` folder.

## 7. Payments & Payouts (Xendit)
- **Collection:** `POST /api/orders/:id/checkout` creates a Payment Request for VA or QRIS and returns a normalized shape (`{ method, va_number | qr_string, amount, expires_at }`)
- **Webhooks are the source of truth.** Verify the callback token header against `XENDIT_WEBHOOK_TOKEN`, insert into `WebhookEvent` (unique `event_id`), then process
- A payment success for an Order no longer in `awaiting_payment` (e.g. already auto-cancelled) must not transition the order. Flag it for admin as a manual refund case
- **Payouts:** on completion, create a `Payout` row, then call Xendit with `idempotency_key`. Status updates come from the payout webhook
- **Refunds:** no API call. Admin transfers through the Xendit dashboard (funds stay within Xendit — never from a personal account) and records `transfer_reference`
- **Legal note:** Daigow orchestrates when money moves; funds sit in Xendit's licensed infrastructure. General information, not legal advice — confirm with Xendit during onboarding

## 8. AI Description (Gemini)
- `POST /api/ai/product-description` receives `{ name, photo_url, category? }`, fetches the uploaded photo server-side, sends image + prompt to Gemini
- Prompt rules: describe only what is visible or given in the name; no invented specs, sizes, authenticity claims, or prices; Bahasa Indonesia; 2–4 short sentences
- 15-second timeout. On any failure return `{ error }` — the form stays usable
- Rate limit per Jastiper (e.g. 60 requests/hour) to cap cost
- The route **never writes to the database**

## 9. Email
- All sends go through one `server/utils/email.ts` wrapper with typed templates
- Email failure must never roll back or block a state transition — log and continue
- Tracking link emails include `/o/{tracking_token}`

## 10. Scheduled Job
Single route, `POST /api/cron/process-deadlines`, every 15 minutes, protected by `CRON_SECRET` header. In order:
1. `awaiting_confirmation` past `confirmation_deadline` → `cancelled` (system, no reason)
2. `awaiting_payment` past `payment_deadline` → `cancelled` (system, no reason). Also expire pending Payments
3. `delivered` past `auto_complete_at` and **not on hold** → `completed` (system) → payout

Each row uses the conditional update from §4, so overlapping runs are safe. Process in batches (e.g. 50) to stay within Vercel function limits.

## 11. Security
- Service role key, Xendit keys, Gemini key: server-only
- Tracking tokens: cryptographically random, never logged
- Webhook and cron routes verify secrets before reading the payload
- Shipping proof served via short-lived signed URLs

## 12. Deferred
Catalog Archival (daily cron), processing deadline, Turnstile, in-app notifications, Realtime chat.
