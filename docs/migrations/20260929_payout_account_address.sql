-- Payouts v3 requires recipient.address.city and recipient.address.street_line_1.
-- Run this once in the Supabase SQL Editor before saving the updated seller form.
alter table public.payout_accounts
  add column if not exists city text,
  add column if not exists street_line_1 text,
  add column if not exists province_state text,
  add column if not exists postal_code text;

comment on column public.payout_accounts.city is 'Recipient city required by Xendit Payouts v3';
comment on column public.payout_accounts.street_line_1 is 'Recipient street address required by Xendit Payouts v3';
