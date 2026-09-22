-- Seed sample products for the first trip that has none yet.
-- Run in Supabase SQL Editor before seed-orders.sql.
do $$
declare
  v_trip_id uuid;
begin
  select id into v_trip_id from trips order by created_at limit 1;

  if v_trip_id is null then
    raise notice 'No trip found — create a trip first.';
    return;
  end if;

  if exists (select 1 from products where trip_id = v_trip_id) then
    raise notice 'Trip % already has products — skipping seed.', v_trip_id;
    return;
  end if;

  insert into products (id, trip_id, name, category, description, description_source, price)
  values
    (gen_random_uuid(), v_trip_id, 'Tote Bag Canvas Jepang', 'Fashion', 'Tote bag kanvas motif Jepang, muat laptop 13 inci.', 'manual', 150000),
    (gen_random_uuid(), v_trip_id, 'Matcha KitKat Box', 'Makanan', 'KitKat rasa matcha, isi 12 pcs, oleh-oleh khas Jepang.', 'manual', 85000),
    (gen_random_uuid(), v_trip_id, 'Skincare Set Hada Labo', 'Kecantikan', 'Paket cleansing + toner + moisturizer Hada Labo.', 'manual', 320000),
    (gen_random_uuid(), v_trip_id, 'Figure Anime Limited Edition', 'Mainan', 'Figure anime edisi terbatas eksklusif Jepang.', 'manual', 450000);

  raise notice 'Seeded 4 sample products on trip %', v_trip_id;
end $$;
