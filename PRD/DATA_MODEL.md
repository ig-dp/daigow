# Data Model: Daigow (Training Edition)

> See [`GLOSSARY.md`](./GLOSSARY.md) for terms and status values, [`PRD.md`](./PRD.md) for the rules this model supports.

## Assumptions
- **One Order belongs to exactly one Trip.** Confirmation, shipping, and payout are per-Jastiper.
- **IDR only.** No currency or exchange-rate fields. Money is `numeric(15,2)`, rounded half-up to whole rupiah at calculation time. Rates are fractions (`0.025` = 2.5%).
- **Guest checkout.** An Order has either a `buyer_id` or guest contact data. Buyer contact fields are **always** filled (copied from the account for registered buyers) so emails never need a join.
- **Refund is its own entity** — multiple partial refunds can occur on one Order.
- **No Dispute, Notification, Wishlist, or verification entities** in this edition.

## Entities

### User (profile table linked to `auth.users`)
| Field | Type | Notes |
|---|---|---|
| id | UUID | = `auth.users.id` |
| name | string | |
| email | string | |
| phone | string, nullable | |
| address | string, nullable | Default shipping address, prefills checkout |
| role | enum: `buyer`, `jastiper`, `admin` | Default `buyer`. `jastiper` via invite code (`POST /api/me/become-jastiper`); `admin` set manually in Supabase. Users must never be able to update their own `role` from the client |
| created_at | timestamp | |

### PayoutAccount
Separate table so bank details get stricter RLS than the public profile.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| jastiper_id | UUID (FK → User), unique | |
| bank_code | string | Xendit channel code |
| account_number | string | |
| account_holder_name | string | |
| city | string | Required by Xendit Payouts v3 recipient address |
| street_line_1 | string | Required by Xendit Payouts v3 recipient address |
| province_state | string, nullable | Recipient province/state |
| postal_code | string, nullable | Recipient postal code |
| updated_at | timestamp | |

### Trip
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| jastiper_id | UUID (FK → User) | role = `jastiper` |
| slug | string, unique | Public URL `/t/:slug` |
| title | string | |
| destination | string | |
| description | text, nullable | |
| thumbnail_url | string | Cover image |
| order_open_at | timestamp | Informational while `coming_soon`; ordering also requires `status = open` |
| order_close_at | timestamp | Orders rejected after this time even if `status = open` |
| status | enum: `coming_soon`, `open`, `closed` | Changed manually by the Jastiper |
| opened_at | timestamp, nullable | Set when status → `open` |
| closed_at | timestamp, nullable | |
| created_at | timestamp | |

### TripSubscriber
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| trip_id | UUID (FK → Trip) | |
| email | string | Unique per `(trip_id, email)` |
| notified_at | timestamp, nullable | Set when the "Trip open" email is sent — prevents duplicate sends |
| created_at | timestamp | |

### Product
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| trip_id | UUID (FK → Trip) | |
| name | string | |
| category | string, nullable | Free text, used for snapshot and optional filter |
| description | text, nullable | |
| description_source | enum: `manual`, `ai`, `ai_edited` | For the "AI adoption" success metric |
| price | decimal | IDR base price; overridden by variant price |
| created_at | timestamp | |

### ProductPhoto
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| product_id | UUID (FK → Product, `ON DELETE CASCADE`) | |
| photo_url | string | |
| sort_order | integer | |

### ProductVariant
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| product_id | UUID (FK → Product, `ON DELETE CASCADE`) | |
| name | string | e.g. "Red", "Size L" |
| photo_url | string, nullable | |
| price | decimal | Overrides `Product.price` |

If a Product has variants, the buyer must select one.

### Order
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| order_number | string, unique | Human-readable, e.g. `DG-240917-0042` |
| trip_id | UUID (FK → Trip) | |
| buyer_id | UUID (FK → User), nullable | Null for guest |
| buyer_name | string | Always filled |
| buyer_email | string | Always filled |
| buyer_phone | string | Always filled |
| shipping_address | text | |
| tracking_token | string, unique | ≥32 random bytes, URL-safe. Used for the tracking link |
| status | enum | See Glossary |
| confirmation_deadline | timestamp | created_at + 24h |
| confirmed_at | timestamp, nullable | |
| payment_deadline | timestamp, nullable | confirmed_at + 48h |
| paid_at | timestamp, nullable | |
| cancellation_reason | string, nullable | Filled on explicit Jastiper rejection or admin cancel; null on timeout |
| cancelled_by | enum: `jastiper`, `system`, `admin`, nullable | |
| shipping_evidence_url | string, nullable | At least one of evidence URL or tracking number required to ship |
| tracking_number | string, nullable | |
| shipped_at | timestamp, nullable | |
| delivered_at | timestamp, nullable | |
| delivered_by | enum: `jastiper`, `buyer`, nullable | |
| auto_complete_at | timestamp, nullable | delivered_at + 72h |
| completed_at | timestamp, nullable | |
| completed_by | enum: `buyer`, `system`, `admin`, nullable | |
| issue_reported_at | timestamp, nullable | Non-null + `issue_resolved_at` null = **on hold** |
| issue_note | text, nullable | |
| issue_resolved_at | timestamp, nullable | |
| issue_resolution | enum: `released`, `cancelled`, nullable | |
| issue_resolved_by | UUID (FK → User, admin), nullable | |
| subtotal_amount | decimal | Sum of all OrderItem line totals at creation |
| platform_fee_rate_snapshot | decimal | |
| platform_fee_amount | decimal | round(subtotal × rate) |
| commission_rate_snapshot | decimal | Used at payout on active items only |
| channel_fee_amount | decimal, default 0 | Set at checkout when a method is chosen |
| total_amount | decimal | subtotal + platform_fee + channel_fee |
| settled_at | timestamp, nullable | Set on `completed` or `cancelled` |
| created_at | timestamp | |

### OrderItem
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| order_id | UUID (FK → Order) | |
| product_id | UUID (FK → Product, nullable, `ON DELETE SET NULL`) | |
| variant_id | UUID (FK → ProductVariant, nullable, `ON DELETE SET NULL`) | |
| quantity | integer | ≥ 1 |
| unit_price | decimal | Variant price if selected, else Product price, at order time |
| line_total | decimal | unit_price × quantity |
| product_name_snapshot | string | Filled at creation |
| category_snapshot | string, nullable | Filled at creation |
| variant_name_snapshot | string, nullable | Filled at creation if variant selected |
| snapshot_photo_url | string | Separate compressed copy in `order-snapshots/`, filled at creation |
| item_status | enum: `active`, `cancelled` | |
| cancelled_at | timestamp, nullable | |

### Payment
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| order_id | UUID (FK → Order) | Many attempts allowed (e.g. expired VA); at most one `paid` |
| payment_method | enum: `va`, `qris` | |
| channel_code | string | e.g. `BCA`, `QRIS` |
| channel_fee_amount | decimal | |
| amount | decimal | Total charged |
| xendit_payment_request_id | string, unique | |
| status | enum: `pending`, `paid`, `failed`, `expired` | |
| expires_at | timestamp | |
| paid_at | timestamp, nullable | |
| created_at | timestamp | |

### Refund
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| order_id | UUID (FK → Order) | |
| order_item_id | UUID (FK → OrderItem), nullable | Set for `partial_item`; null for order-level refunds |
| refund_type | enum: `partial_item`, `full_order`, `admin_cancel` | Determines fee inclusion (PRD §7) |
| item_amount_refunded | decimal | |
| platform_fee_refunded | decimal | 0 for `partial_item` |
| channel_fee_refunded | decimal | Always 0 |
| total_refund_amount | decimal | |
| status | enum: `pending_transfer`, `transferred` | Transfer is manual |
| transferred_at | timestamp, nullable | |
| transferred_by | UUID (FK → User, admin), nullable | |
| transfer_reference | string, nullable | Reference from the Xendit dashboard transfer |
| created_at | timestamp | |

**Full-cancellation refund after earlier partial refunds:** the `full_order`/`admin_cancel` refund covers only items **not already refunded** plus the full platform fee. Total refunded across all rows must never exceed `subtotal_amount + platform_fee_amount`.

### Payout
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| order_id | UUID (FK → Order), unique | One payout per Order |
| jastiper_id | UUID (FK → User) | |
| active_subtotal | decimal | Sum of active item line totals |
| commission_amount | decimal | round(active_subtotal × commission_rate_snapshot) |
| payout_amount | decimal | active_subtotal − commission_amount |
| bank_code / account_number / account_holder_name | string | Snapshot of PayoutAccount at request time |
| idempotency_key | string, unique | Sent to Xendit; = `payout-{order_id}-{attempt}` |
| xendit_payout_id | string, nullable | |
| status | enum: `pending`, `succeeded`, `failed` | Updated from webhook |
| failure_reason | string, nullable | |
| attempt | integer | Incremented on admin retry |
| requested_at | timestamp | |
| completed_at | timestamp, nullable | |

### WebhookEvent
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| provider | string | `xendit` |
| event_id | string, unique | Xendit event/webhook id — insert first, skip if duplicate |
| event_type | string | |
| payload | jsonb | |
| processed_at | timestamp, nullable | |
| created_at | timestamp | |

### PlatformConfig
Single row, edited in Supabase Table Editor.

| Field | Type | Notes |
|---|---|---|
| id | integer | Always `1` |
| commission_rate | decimal | Default `0.025` |
| platform_fee_rate | decimal | Default `0.015` |
| updated_at | timestamp | |

## Relationships
```
User (jastiper) 1───0/1 PayoutAccount
User (jastiper) 1───*   Trip
Trip            1───*   TripSubscriber
Trip            1───*   Product
Product         1───*   ProductPhoto
Product         1───*   ProductVariant
Trip            1───*   Order
User (buyer)    1───*   Order (optional — guest orders have none)
Order           1───*   OrderItem
Order           1───*   Payment (at most one paid)
Order           1───*   Refund
Order           1───0/1 Payout
```

## Design Decisions
- **Snapshot at order creation.** Even without Catalog Archival in this edition, snapshots are filled at creation so a Jastiper editing or deleting a product never changes order history — and so archival can be added later without a data migration.
- **"On hold" is a flag, not a status.** An issue can be reported from three statuses; resolution needs to know where it came from.
- **Refund transfers are manual but amounts are not.** The system is the source of truth for how much to refund; admin only executes the transfer.
- **Product deletion** is blocked if any OrderItem references it (soft-hide instead).

## Deferred (post-training)
- `Trip.catalog_archived_at` and the Catalog Archival job
- `processing_deadline` + reminder
- Formal Dispute entity, verification status, in-app notifications, wishlist
