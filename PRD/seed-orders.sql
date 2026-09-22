-- Seed sample orders for the first trip that has products, so the seller
-- Pesanan page has data to preview. Safe to re-run (skips if that trip
-- already has orders). Run in Supabase SQL Editor.
do $$
declare
  v_trip_id uuid;
  v_product record;
  v_order_id uuid;
  v_unit_price numeric;
  v_line_total numeric;
  v_platform_fee numeric;
begin
  select t.id into v_trip_id
  from trips t
  where exists (select 1 from products p where p.trip_id = t.id)
  order by t.created_at
  limit 1;

  if v_trip_id is null then
    raise notice 'No trip with products found — create a trip + product first.';
    return;
  end if;

  if exists (select 1 from orders where trip_id = v_trip_id) then
    raise notice 'Trip % already has orders — skipping seed.', v_trip_id;
    return;
  end if;

  -- One order per status, using the first product from the trip.

  -- Order 1: awaiting_confirmation (Pending)
  select id, price into v_product from products where trip_id = v_trip_id order by created_at limit 1;
  v_unit_price := v_product.price;
  v_line_total := v_unit_price;
  v_platform_fee := round(v_line_total * 0.015);
  insert into orders (id, order_number, trip_id, buyer_id, buyer_name, buyer_email, buyer_phone, shipping_address, tracking_token, status, confirmation_deadline, subtotal_amount, platform_fee_rate_snapshot, platform_fee_amount, commission_rate_snapshot, channel_fee_amount, total_amount, created_at)
  values (gen_random_uuid(), 'DG-260101-0001', v_trip_id, null, 'Rani Putri', 'rani@example.com', '081200000001', 'Jl. Contoh No. 1, Jakarta', encode(gen_random_bytes(32), 'base64'), 'awaiting_confirmation', now() + interval '24 hours', v_line_total, 0.015, v_platform_fee, 0.025, 0, v_line_total + v_platform_fee, now() - interval '2 days')
  returning id into v_order_id;
  insert into order_items (id, order_id, product_id, variant_id, quantity, unit_price, line_total, product_name_snapshot, category_snapshot, variant_name_snapshot, snapshot_photo_url, item_status)
  select gen_random_uuid(), v_order_id, p.id, null, 1, p.price, p.price, p.name, p.category, null, coalesce((select photo_url from product_photos where product_id = p.id order by sort_order limit 1), ''), 'active'
  from products p where p.id = v_product.id;

  -- Order 2: awaiting_payment (Menunggu Pembayaran)
  select id, price into v_product from products where trip_id = v_trip_id order by created_at limit 1;
  v_unit_price := v_product.price;
  v_line_total := v_unit_price;
  v_platform_fee := round(v_line_total * 0.015);
  insert into orders (id, order_number, trip_id, buyer_id, buyer_name, buyer_email, buyer_phone, shipping_address, tracking_token, status, confirmation_deadline, confirmed_at, payment_deadline, subtotal_amount, platform_fee_rate_snapshot, platform_fee_amount, commission_rate_snapshot, channel_fee_amount, total_amount, created_at)
  values (gen_random_uuid(), 'DG-260101-0002', v_trip_id, null, 'Citra Dewi', 'citra@example.com', '081200000002', 'Jl. Contoh No. 2, Bandung', encode(gen_random_bytes(32), 'base64'), 'awaiting_payment', now() + interval '24 hours', now() - interval '1 day', now() + interval '2 days', v_line_total, 0.015, v_platform_fee, 0.025, 0, v_line_total + v_platform_fee, now() - interval '3 days')
  returning id into v_order_id;
  insert into order_items (id, order_id, product_id, variant_id, quantity, unit_price, line_total, product_name_snapshot, category_snapshot, variant_name_snapshot, snapshot_photo_url, item_status)
  select gen_random_uuid(), v_order_id, p.id, null, 1, p.price, p.price, p.name, p.category, null, coalesce((select photo_url from product_photos where product_id = p.id order by sort_order limit 1), ''), 'active'
  from products p where p.id = v_product.id;

  -- Order 3: shipped (Dikirim)
  select id, price into v_product from products where trip_id = v_trip_id order by created_at limit 1;
  v_unit_price := v_product.price;
  v_line_total := v_unit_price;
  v_platform_fee := round(v_line_total * 0.015);
  insert into orders (id, order_number, trip_id, buyer_id, buyer_name, buyer_email, buyer_phone, shipping_address, tracking_token, status, confirmation_deadline, confirmed_at, payment_deadline, paid_at, shipping_evidence_url, tracking_number, shipped_at, subtotal_amount, platform_fee_rate_snapshot, platform_fee_amount, commission_rate_snapshot, channel_fee_amount, total_amount, created_at)
  values (gen_random_uuid(), 'DG-260101-0003', v_trip_id, null, 'Budi Santoso', 'budi@example.com', '081200000003', 'Jl. Contoh No. 3, Surabaya', encode(gen_random_bytes(32), 'base64'), 'shipped', now() - interval '1 day', now() - interval '4 days', now() - interval '2 days', now() - interval '3 days', 'https://example.com/evidence.jpg', 'JNE1234567890', now() - interval '1 day', v_line_total, 0.015, v_platform_fee, 0.025, 5000, v_line_total + v_platform_fee + 5000, now() - interval '5 days')
  returning id into v_order_id;
  insert into order_items (id, order_id, product_id, variant_id, quantity, unit_price, line_total, product_name_snapshot, category_snapshot, variant_name_snapshot, snapshot_photo_url, item_status)
  select gen_random_uuid(), v_order_id, p.id, null, 1, p.price, p.price, p.name, p.category, null, coalesce((select photo_url from product_photos where product_id = p.id order by sort_order limit 1), ''), 'active'
  from products p where p.id = v_product.id;

  -- Order 4: completed (Selesai)
  select id, price into v_product from products where trip_id = v_trip_id order by created_at limit 1;
  v_unit_price := v_product.price;
  v_line_total := v_unit_price;
  v_platform_fee := round(v_line_total * 0.015);
  insert into orders (id, order_number, trip_id, buyer_id, buyer_name, buyer_email, buyer_phone, shipping_address, tracking_token, status, confirmation_deadline, confirmed_at, payment_deadline, paid_at, shipping_evidence_url, tracking_number, shipped_at, delivered_at, delivered_by, auto_complete_at, completed_at, completed_by, subtotal_amount, platform_fee_rate_snapshot, platform_fee_amount, commission_rate_snapshot, channel_fee_amount, total_amount, settled_at, created_at)
  values (gen_random_uuid(), 'DG-260101-0004', v_trip_id, null, 'Agus Wijaya', 'agus@example.com', '081200000004', 'Jl. Contoh No. 4, Yogyakarta', encode(gen_random_bytes(32), 'base64'), 'completed', now() - interval '8 days', now() - interval '9 days', now() - interval '7 days', now() - interval '6 days', 'https://example.com/evidence2.jpg', 'JNE0987654321', now() - interval '5 days', now() - interval '3 days', 'buyer', now(), now() - interval '2 days', 'buyer', v_line_total, 0.015, v_platform_fee, 0.025, 5000, v_line_total + v_platform_fee + 5000, now() - interval '2 days', now() - interval '10 days')
  returning id into v_order_id;
  insert into order_items (id, order_id, product_id, variant_id, quantity, unit_price, line_total, product_name_snapshot, category_snapshot, variant_name_snapshot, snapshot_photo_url, item_status)
  select gen_random_uuid(), v_order_id, p.id, null, 1, p.price, p.price, p.name, p.category, null, coalesce((select photo_url from product_photos where product_id = p.id order by sort_order limit 1), ''), 'active'
  from products p where p.id = v_product.id;

  raise notice 'Seeded 4 sample orders on trip %', v_trip_id;
end $$;
