# Acceptance Criteria: Daigow (Training Edition)

> Given/When/Then scenarios for logic most likely to be implemented wrong. References: [`PRD.md`](./PRD.md), [`DATA_MODEL.md`](./DATA_MODEL.md).

**Reference order used in examples:** Item A = Rp600.000 (qty 1), Item B = Rp400.000 (qty 1). Subtotal Rp1.000.000. Platform fee 1.5% = Rp15.000. Commission rate 2.5%. VA channel fee Rp4.500 (example). Total Rp1.019.500.

---

## 1. Trip & Subscribe

**AC-1.1 — Coming soon hides products**
- Given a Trip with `status = coming_soon`
- When anyone opens `/t/:slug`
- Then Trip info and a subscribe form are shown, products are not returned by the API, and `POST /api/orders` for that Trip returns 409

**AC-1.2 — Subscribe is idempotent**
- Given `a@x.com` already subscribed to a Trip
- When `a@x.com` subscribes again
- Then no duplicate row is created and the response is still success

**AC-1.3 — Opening notifies subscribers once**
- Given a `coming_soon` Trip with 3 subscribers
- When the Jastiper opens it
- Then 3 emails are sent and all `notified_at` are set; calling open again returns 409 and sends nothing

**AC-1.4 — Order window enforced**
- Given an `open` Trip whose `order_close_at` has passed
- When a buyer places an order
- Then it is rejected, even though status is still `open`

## 2. AI Description

**AC-2.1 — Draft is never auto-saved**
- Given a Jastiper requests an AI description
- When the draft returns
- Then it appears in the form only; no Product row is created or updated until the Jastiper saves

**AC-2.2 — Failure doesn't block**
- Given Gemini times out or errors
- When the Jastiper requests a draft
- Then an error message is shown and the Jastiper can type and save a manual description

**AC-2.3 — Source is tracked**
- When a Product is saved with an unedited draft → `description_source = ai`; with an edited draft → `ai_edited`; without using AI → `manual`

## 3. Order Creation & Snapshot

**AC-3.1 — Guest checkout**
- Given a visitor without a session
- When they order with name, email, phone, address
- Then the Order has `buyer_id = null`, all buyer contact fields filled, a unique `tracking_token`, and the tracking link is emailed

**AC-3.2 — Registered checkout**
- Given a logged-in buyer
- Then `buyer_id` is set and `buyer_name/email/phone` are still copied onto the Order

**AC-3.3 — Variant price override**
- Given a Product priced Rp500.000 with variant "L" priced Rp550.000
- When the buyer orders variant "L"
- Then `unit_price = 550000`, `variant_name_snapshot = "L"`

**AC-3.4 — Variant required**
- Given a Product with variants
- When an order item omits `variant_id`
- Then the request is rejected

**AC-3.5 — Snapshot at creation**
- When an OrderItem is created
- Then `product_name_snapshot`, `category_snapshot`, `variant_name_snapshot` (if any), and `snapshot_photo_url` are filled immediately, and later edits to the Product don't change them

**AC-3.6 — Fees snapshotted**
- Given `PlatformConfig` rates at order time are 1.5% / 2.5%
- When admin later changes them to 2% / 3%
- Then existing Orders keep `platform_fee_rate_snapshot = 0.015` and `commission_rate_snapshot = 0.025`

**AC-3.7 — One Trip per order**
- When items from two different Trips are submitted in one order
- Then the request is rejected

## 4. Confirmation & Payment

**AC-4.1 — Confirm**
- Given `awaiting_confirmation`
- When the Jastiper confirms before `confirmation_deadline`
- Then `status = awaiting_payment`, `payment_deadline = confirmed_at + 48h`, buyer emailed

**AC-4.2 — Reject needs reason**
- When the Jastiper rejects without a reason → validation error
- When with a reason → `cancelled`, `cancellation_reason` set, `cancelled_by = jastiper`, `settled_at` set, buyer emailed with the reason

**AC-4.3 — Confirmation timeout**
- Given `awaiting_confirmation` past deadline
- When cron runs
- Then `cancelled`, `cancellation_reason = null`, `cancelled_by = system`

**AC-4.4 — Payment timeout**
- Given `awaiting_payment` past `payment_deadline`
- When cron runs
- Then `cancelled` (reason null), pending Payments marked `expired`

**AC-4.5 — Payment success**
- Given `awaiting_payment` with a pending VA Payment
- When the Xendit paid webhook arrives
- Then Payment `paid`, Order `processing`, `paid_at` set, Jastiper emailed

**AC-4.6 — Webhook retry is a no-op**
- When the same webhook `event_id` arrives twice
- Then the second is ignored; no duplicate emails or transitions

**AC-4.7 — Payment after auto-cancel**
- Given an Order already auto-cancelled
- When a paid webhook arrives for it
- Then the Order stays `cancelled`, the payment is recorded and listed in admin "orphaned payments" for manual refund

**AC-4.8 — Race: cron vs webhook**
- Given cron and a paid webhook process the same Order concurrently
- Then exactly one transition succeeds (conditional update on `status`); the other does nothing

## 5. Fulfillment & Completion

**AC-5.1 — Ship requires evidence**
- When the Jastiper ships with neither `shipping_evidence_url` nor `tracking_number` → rejected

**AC-5.2 — Either party marks delivered**
- Given `shipped`
- When the Jastiper **or** buyer marks delivered
- Then `delivered`, `delivered_at` set, `auto_complete_at = delivered_at + 72h`, `delivered_by` records who

**AC-5.3 — Buyer confirms**
- Given `delivered`, not on hold
- When the buyer confirms receipt
- Then `completed`, `completed_by = buyer`, `settled_at` set, Payout created

**AC-5.4 — Auto-complete**
- Given `delivered`, past `auto_complete_at`, not on hold
- When cron runs
- Then `completed`, `completed_by = system`, Payout created

**AC-5.5 — Payout amount**
- Given the reference order, no cancellations, completed
- Then `active_subtotal = 1000000`, `commission_amount = 25000`, `payout_amount = 975000`

**AC-5.6 — No payout account**
- Given the Jastiper has no PayoutAccount
- When the order completes
- Then the order still completes, the Payout is `failed` with a clear reason, admin and Jastiper emailed

**AC-5.7 — Payout is never duplicated**
- When completion is triggered twice (double click, cron overlap)
- Then only one Payout row exists (unique `order_id`) and Xendit is called once per `idempotency_key`

## 6. Reported Issue (On Hold)

**AC-6.1 — Hold blocks completion**
- Given `delivered` with an issue reported before `auto_complete_at`
- When `auto_complete_at` passes and cron runs
- Then the Order stays `delivered`; buyer "confirm received" also returns 409

**AC-6.2 — Allowed statuses**
- Issue can be reported in `processing`, `shipped`, `delivered`; rejected in all other statuses

**AC-6.3 — One report only**
- Given an issue already reported (resolved or not)
- When the buyer reports again → rejected

**AC-6.4 — Admin release**
- Given an on-hold order in `delivered`
- When admin releases
- Then `completed`, `completed_by = admin`, `issue_resolution = released`, Payout created
- And release is rejected for an on-hold order still in `processing`

**AC-6.5 — Admin cancel**
- Given an on-hold paid order
- When admin cancels
- Then `cancelled`, `issue_resolution = cancelled`, `admin_cancel` Refund created with full-cancellation fee rules

## 7. Cancellation & Refund (highest risk)

**AC-7.1 — Partial cancellation excludes fees**
- Given the reference order in `processing`
- When the Jastiper cancels Item B
- Then one Refund: `partial_item`, item 400000, platform fee 0, channel fee 0, total 400000, status `pending_transfer`; Order stays `processing`

**AC-7.2 — Commission only on active items**
- Given AC-7.1 then the order completes
- Then `active_subtotal = 600000`, `commission_amount = 15000`, `payout_amount = 585000`

**AC-7.3 — Cascade to full cancellation**
- Given AC-7.1 (B cancelled)
- When the Jastiper cancels Item A
- Then: partial Refund for A is **not** created separately; instead a `full_order` Refund with item 600000 + platform fee 15000 = 615000, channel fee 0. Order `cancelled`, `settled_at` set
- And total refunded across both rows = 1015000 (= subtotal + platform fee), never including the Rp4.500 channel fee

**AC-7.4 — Full cancel in one go**
- Given the reference order, admin cancels while on hold
- Then one `admin_cancel` Refund: item 1000000 + platform fee 15000 = 1015000, channel fee 0

**AC-7.5 — Refund ceiling**
- For any Order, sum of `total_refund_amount` ≤ `subtotal_amount + platform_fee_amount`

**AC-7.6 — Cancel only in processing**
- Item cancellation is rejected once the order is `shipped` or later

**AC-7.7 — Manual transfer marking**
- When admin marks a Refund transferred with a reference
- Then `status = transferred`, `transferred_at/by` set, buyer emailed; marking again returns 409

**AC-7.8 — No refund before payment**
- Rejection or timeout in `awaiting_confirmation`/`awaiting_payment` creates no Refund

## 8. Rounding

**AC-8.1 — Half-up to whole rupiah**
- Subtotal Rp333.333 × 1.5% = 4999.995 → platform fee Rp5.000
- Subtotal Rp100.100 × 2.5% = 2502.5 → commission Rp2.503

## 9. Access

**AC-9.0 — Become Jastiper with invite code**
- Given a logged-in `buyer`
- When they submit the correct invite code → `role = jastiper`, seller dashboard accessible
- When they submit a wrong code → 403, role unchanged
- When they submit a 6th attempt within an hour → 429
- When a `jastiper` or `admin` submits any code → 409, role unchanged
- When any user tries to update `role` directly through the Supabase client → blocked

**AC-9.1 — Tracking token scope**
- A valid token for Order X grants no access to Order Y or to any Jastiper/admin route

**AC-9.2 — Guest cannot use seller routes**
- Requests to `/api/seller/*` or `/api/admin/*` without the matching role return 403
