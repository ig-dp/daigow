-- Storage bucket for seller shipping evidence photos.
insert into storage.buckets (id, name, public)
values ('shipping-proof', 'shipping-proof', true)
on conflict (id) do update set public = true;

drop policy if exists "Seller can upload own shipping proof" on storage.objects;

create policy "Seller can upload own shipping proof"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'shipping-proof'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
