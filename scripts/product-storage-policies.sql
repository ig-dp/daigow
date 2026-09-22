-- Product images are public; only a seller can upload JPEGs to their own folder.
-- Run against the Daigow project after creating the products bucket.
begin;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own on public.profiles
      for select to authenticated
      using (id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'products_seller_insert'
  ) then
    create policy products_seller_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'products'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and storage.extension(name) = 'jpg'
        and exists (
          select 1 from public.profiles
          where id = (select auth.uid()) and role::text in ('jastiper', 'admin')
        )
      );
  end if;
end
$$;

commit;
