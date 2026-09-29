-- Run in Supabase SQL Editor. Idempotent: safe to re-run.

-- Buyer's default shipping address, used to prefill checkout.
alter table public.profiles add column if not exists address text;

-- Every new auth user gets a profile row (role defaults to 'buyer').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users created before the trigger existed.
insert into public.profiles (id, email, name)
select u.id, u.email, coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- Single-row platform config (DATA_MODEL: PlatformConfig).
insert into public.platform_config (id, commission_rate, platform_fee_rate)
values (1, 0.025, 0.015)
on conflict (id) do nothing;
