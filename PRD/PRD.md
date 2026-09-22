# PRD: Daigow — Training Edition (2-Week MVP)

> This is a **fork** of the original Daigow spec, cut down for a 2-week training build. Where this document differs from the original, this document wins for this repo. Domain terms are defined in [`GLOSSARY.md`](./GLOSSARY.md).

## 1. Overview
**Daigow** connects **Jastiper** (jastip sellers) with **Pembeli** (buyers). A Jastiper creates a Trip, fills its catalog (with AI help for product descriptions), and shares the Trip's public link. Pembeli — with or without an account — order, pay through escrow, and track the order via a unique link.

## 2. Problem Statement
- **Scattered, unstructured ordering.** Jastip runs in chat groups: hundreds of product photos, orders taken by DM, tracked manually by the Jastiper.
- **Buyer trust.** Buyers transfer money directly to a personal account with no guarantee. Escrow removes that risk.
- **Catalog effort.** Writing descriptions for hundreds of items per Trip is slow. AI drafts reduce the time from "arrived at the store" to "product live".

## 3. Goals & Non-Goals
**Goals (training build):**
- Jastiper can publish a Trip and catalog quickly, with AI-drafted descriptions
- Registered and guest buyers can order and pay through escrow
- Payout to the Jastiper is released automatically once the buyer confirms receipt or auto-complete fires
- No Order can remain stuck indefinitely

**Non-Goals:**
- Homepage / marketplace listing of Trips (Jastiper share their Trip link themselves)
- Wishlist
- Multi-currency pricing and exchange rates (prices are entered directly in IDR)
- Jastiper verification flow (pilot access is gated by an invite code instead, see §6)
- Formal in-app Dispute entity (issues are handled manually by admin, see §6)
- Automated refund transfers (refund amounts are computed by the system, transfers are done manually by admin)
- In-app notifications, WhatsApp notifications (email only)
- Bot protection (Cloudflare Turnstile)
- Catalog Archival (deferred — cannot run within a 2-week window anyway, since it needs 30 days post-settlement)
- Processing deadline and T-3 reminder
- Google OAuth, chat, ratings, boost, paid plans, courier API integration

## 4. Target Users
- **Jastiper** — creates Trips and products, confirms orders, ships, cancels unavailable items. Registers as a normal user, then upgrades to Jastiper with a shared invite code (closed pilot).
- **Pembeli (registered)** — has an account, sees order history.
- **Pembeli (guest)** — checks out with name, email, and phone; manages the order via a unique tracking link sent by email.
- **Admin** — single role. Resolves reported issues, executes manual refund transfers, monitors payouts.

## 5. User Stories
- As a **Jastiper**, I want to announce a Trip as "coming soon" so interested buyers can subscribe before it opens.
- As a **Jastiper**, I want an AI-drafted description from a product photo and name, so I can publish products faster.
- As a **Jastiper**, I want to confirm or reject each order before the buyer pays, so buyers never pay for something I can't get.
- As a **Pembeli**, I want to check out without creating an account.
- As a **Pembeli**, I want to track and manage my order through a link.
- As a **Pembeli**, I want to report a problem so my money isn't released while the issue is open.
- As an **Admin**, I want to either release funds or cancel an order that has a reported issue.

## 6. Requirements

### Functional — Becoming a Jastiper
- Every new account starts as `buyer`
- On the account page, a logged-in buyer can enter a Jastiper invite code
- If the code matches the server-side `JASTIPER_INVITE_CODE`, the account role becomes `jastiper` and the seller dashboard becomes available
- The code is shared with pilot sellers outside the app. Rotating it does not affect existing Jastiper accounts
- Admin accounts are still set manually in Supabase

### Functional — Trip
- Trip fields: title, destination, cover image, order open/close period, public slug
- Status: `coming_soon` → `open` → `closed`
- While `coming_soon`, the public page shows the Trip info and a subscribe form (email). Products are hidden and ordering is disabled
- The Jastiper opens the Trip manually. Opening sends an email to all subscribers
- Orders are accepted only while `status = open` **and** now is between `order_open_at` and `order_close_at`
- The Jastiper can close the Trip manually at any time

### Functional — Product
- Product: name, description, base price (IDR), multiple photos
- Optional variants, each with its own name, optional photo, and price that overrides the base price
- **AI description:** after uploading a photo and entering a name, the Jastiper can request a draft description (Gemini 2.5 Flash-Lite). The draft appears in the form, editable. It is never saved without the Jastiper saving the form. If the AI call fails, the Jastiper can still type a description manually

### Functional — Order Lifecycle & Escrow
Status flow: Awaiting Confirmation → Awaiting Payment → Processing → Shipped → Delivered → Completed / Cancelled

| Status | How it exits | Timeout |
|---|---|---|
| Awaiting Confirmation | Jastiper confirms → Awaiting Payment; Jastiper rejects (reason required) → Cancelled | 24h → auto-cancel (no reason) |
| Awaiting Payment | Payment succeeds (Xendit webhook) → Processing | 2x24h from confirmation → auto-cancel (no reason) |
| Processing | Jastiper ships (evidence required) → Shipped; all items cancelled → Cancelled | None — buyer can report an issue, admin resolves |
| Shipped | Jastiper or buyer marks delivered → Delivered | None — buyer can mark delivered or report an issue |
| Delivered | Buyer confirms receipt → Completed | 3x24h → auto-complete |
| Completed / Cancelled | Final | – |

- Escrow: funds stay in Daigow's Xendit balance; payout to the Jastiper is triggered only on completion
- Shipping evidence (photo and/or tracking number, entered manually) is required when marking **Shipped**. Marking Delivered does not require new evidence
- One scheduled job (`process-deadlines`) handles the three timeouts above

### Functional — Reported Issue (manual dispute)
- Buyer can report an issue while the order is `processing`, `shipped`, or `delivered`, with a short note
- A reported issue **places the order on hold**: auto-complete does not fire and the buyer cannot confirm receipt until resolved
- Admin is emailed. Investigation happens outside the system (email/phone)
- Admin resolves with one of two actions:
  - **Release** (only from `shipped`/`delivered`) → order Completed, payout triggered
  - **Cancel** → order Cancelled, refund computed with full-cancellation rules
- Resolution is final. A second report on the same order is not allowed

### Functional — Cancellation & Refund
*(Applies after payment. Rejection during Awaiting Confirmation cancels before any payment, so no refund exists.)*
- Jastiper can cancel individual items while the order is `processing`
- The system immediately creates a `Refund` record with the computed amount (fee rules in §7) and emails the buyer the amount
- Admin transfers the refund manually through the Xendit dashboard and marks the Refund as transferred
- If all items end up cancelled, the order becomes Cancelled and the platform fee refund is added

### Functional — Email Notifications
Email is the only channel. Required emails:
- To Jastiper: new order awaiting confirmation, payment received, issue reported, payout sent / payout failed
- To buyer: order received (with tracking link), order confirmed (pay now), order rejected (with reason), order auto-cancelled, item cancelled (refund amount), order shipped, order delivered (confirm or report), order completed, order cancelled, refund transferred
- To subscribers: Trip is now open
- To admin: issue reported, payout failed

### Non-Functional
- Mobile-first
- IDR only; amounts rounded half-up to whole rupiah

## 7. Monetization & Fee Structure

| Component | Default | Notes |
|---|---|---|
| Seller commission | 2.5% of active item subtotal | Deducted from payout. Rate snapshotted per Order at creation |
| Platform fee (buyer) | 1.5% of subtotal | Added at checkout. Rate snapshotted per Order at creation |
| Payment channel fee | Per Xendit rate for the chosen method | Added at checkout, buyer-borne |

Rates live in a single `PlatformConfig` row, edited directly in Supabase for the training build. Changes never apply to existing Orders.

**Fee refund rules:**

| Condition | Item price | Platform fee | Channel fee |
|---|---|---|---|
| Partial item cancellation | Refunded | Not refunded | Not refunded |
| Full cancellation (all items) | Refunded | Refunded | Not refunded |
| Issue resolved by admin with Cancel | Refunded | Refunded | Not refunded |

## 8. Payout
- On completion: payout = active item subtotal − commission (on active items)
- Triggered automatically through Xendit Payouts. Requires the Jastiper to have a payout bank account set
- Failed payout → admin and Jastiper emailed; admin can retry after the account is fixed

## 9. Success Metrics (pilot)
- Pilot Jastiper run at least one complete Trip end-to-end
- Majority of confirmed orders are paid without confusion
- Majority of products use the AI draft
- Zero orders stuck without a path to settlement; zero payouts lost

## 10. Constraints
- 2-week build, solo developer with AI assistance
- Xendit account activation (especially Payouts) has external lead time — register on day 0 and develop in test mode meanwhile

## 11. Open Questions
- Email provider choice (e.g. Resend) and sending domain
- Xendit Payouts minimum amount and fee — confirm against the current rate card
- Whether the platform absorbs the Xendit payout fee or deducts it from the Jastiper payout
