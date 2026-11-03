-- Tradelink mock data (optional). Runs AFTER supabase/seed.sql, on a database that already has the demo seed.
-- It adds more fictional businesses so every flow can be tried by signing in as different accounts.
-- Every person and business here is fictional; emails use the reserved .example domain.
-- All new accounts share the seed password Tradelink-demo-2026.
--
-- Run it once, in one psql session, stopping at the first error:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/mock-data.sql
-- The guard in step 0 refuses a second run.
--
-- What it adds:
--   Buyers     Lotus Leaf Vegetarian (Siti Rahim), Golden Crust Bakery (Wei Jie Lim)
--   Supplier   Island Spice Traders (Ravi Kumar), 8 products IS-3001 to IS-3008, opening stock on the stock history
--   Links      both new buyers to Harbour Dry Goods, Fresh Lane Produce and Island Spice Traders;
--              Mei's Noodle House and Seaside Kopitiam to Island Spice Traders
--   Usual items for both new buyers, 15 orders in every state (M01 to M15 below), 3 problems, 1 late report,
--   1 dispute and 2 price changes.
--
-- Orders, issues, stock and notifications are created through the real write functions (place_orders,
-- accept_order, part_accept_order, reject_order, mark_out_for_delivery, mark_delivered, confirm_all_here,
-- report_problem, report_not_here, answer_issue, change_price) by impersonating the user in each transaction,
-- so reservations, the stock history, audit log and notifications stay consistent. Step 9 then backdates the
-- rows that may be updated (orders, issues, partial fulfilments, notifications) so the history spreads over
-- the last 10 days. order_events, stock_movements, audit_log and price_changes are append-only, so their
-- timestamps stay at the time this script ran.
--
-- Fixed ids (a new "d" range that does not collide with seed.sql):
--   organisations 00000000-0000-4000-8000-0000000000d1 Lotus Leaf, d2 Golden Crust, d3 Island Spice
--   users         00000000-0000-4000-9000-0000000000d1 Siti, d2 Wei Jie, d3 Ravi (same suffix as the organisation)
--   products      00000000-0000-4000-8000-000000000d01 to d08 (IS-3001 to IS-3008)
--   request keys  00000000-0000-4000-a000-000000000Snn, S = step (1 place, 2 accept, 3 out, 4 delivered,
--                 5 check or report, 6 answer, 7 price), nn = mock order M01 to M15 (or price change 01, 02)
-- Order ids and numbers come from place_orders; later steps find an order through the stored result of its
-- place_orders request key (public.idempotency_keys).
--
-- Mock orders (Singapore time; numbers follow on from the existing orders. On the live project, run on
-- 3 Nov 2026, M01 to M15 became ORD-1051 to ORD-1065 and the problems ISS-302 to ISS-305):
--   M01 Lotus Leaf  -> Harbour Dry Goods    delivered 26 Oct, all here
--   M02 Lotus Leaf  -> Island Spice         delivered 27 Oct, all here (buyer confirmed while out for delivery)
--   M03 Golden Crust-> Harbour Dry Goods    delivered 28 Oct, all here
--   M04 Lotus Leaf  -> Fresh Lane Produce   rejected 28 Oct
--   M05 Golden Crust-> Fresh Lane Produce   delivered 29 Oct, 1 carton of eggs damaged, credit promised
--   M06 Golden Crust-> Island Spice         delivered 2 Nov, 4 palm sugar wrong item, disputed by the supplier
--   M07 Lotus Leaf  -> Harbour Dry Goods    delivered 2 Nov, 3 noodles short, problem still open
--   M08 Lotus Leaf  -> Island Spice         out for delivery today
--   M09 Golden Crust-> Harbour Dry Goods    out for delivery today
--   M10 Golden Crust-> Harbour Dry Goods    accepted for tomorrow
--   M11 Lotus Leaf  -> Fresh Lane Produce   out for delivery today, reported not here (late, open)
--   M12 Lotus Leaf  -> Harbour Dry Goods    accepted for tomorrow
--   M13 Golden Crust-> Island Spice         part accepted for tomorrow (6 of 12 star anise)
--   M14 Lotus Leaf  -> Island Spice         pending
--   M15 Golden Crust-> Island Spice         pending

-- 0. Guard ------------------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from public.organisations where id = '00000000-0000-4000-8000-0000000000d1') then
    raise exception 'mock-data.sql has already been applied';
  end if;
  if not exists (select 1 from public.organisations where id = '00000000-0000-4000-8000-0000000000c1') then
    raise exception 'run supabase/seed.sql first';
  end if;
end $$;

-- 1. Businesses, users, catalogue, opening stock and usual items -----------------------------------------

begin;

insert into public.organisations (id, kind, name, status, contact_name, phone, email, address, invited_by_org_id, joined_at, created_at) values
  ('00000000-0000-4000-8000-0000000000d1', 'buyer', 'Lotus Leaf Vegetarian', 'active', 'Siti Rahim', '+65 6000 0103',
   'siti@lotusleaf.example', '9 Temple Lane, #01-05', null, '2026-10-12 09:00+08', '2026-10-12 09:00+08'),
  ('00000000-0000-4000-8000-0000000000d2', 'buyer', 'Golden Crust Bakery', 'active', 'Wei Jie Lim', '+65 6000 0104',
   'weijie@goldencrust.example', '46 Oven Row, #01-21', null, '2026-10-19 09:00+08', '2026-10-19 09:00+08'),
  ('00000000-0000-4000-8000-0000000000d3', 'supplier', 'Island Spice Traders', 'active', 'Ravi Kumar', '+65 6000 0204',
   'ravi@islandspice.example', '3 Spice Wharf, #03-08', null, '2026-10-05 09:00+08', '2026-10-05 09:00+08');

-- No tl_kind in the metadata, so the on_auth_user_created trigger leaves these users alone and the
-- organisation rows above are the only ones created.
with people (id, email, full_name, created_at) as (
  values
    ('00000000-0000-4000-9000-0000000000d1'::uuid, 'siti@lotusleaf.example', 'Siti Rahim', '2026-10-12 09:00+08'::timestamptz),
    ('00000000-0000-4000-9000-0000000000d2'::uuid, 'weijie@goldencrust.example', 'Wei Jie Lim', '2026-10-19 09:00+08'::timestamptz),
    ('00000000-0000-4000-9000-0000000000d3'::uuid, 'ravi@islandspice.example', 'Ravi Kumar', '2026-10-05 09:00+08'::timestamptz)
),
new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  select
    '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email,
    extensions.crypt('Tradelink-demo-2026', extensions.gen_salt('bf')), p.created_at,
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p.full_name), p.created_at, p.created_at,
    '', '', '', ''
  from people p
  returning id, email, created_at
)
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', null, u.created_at, u.created_at
from new_users u;

insert into public.profiles (user_id, full_name, phone, email, created_at) values
  ('00000000-0000-4000-9000-0000000000d1', 'Siti Rahim', '+65 6000 0103', 'siti@lotusleaf.example', '2026-10-12 09:00+08'),
  ('00000000-0000-4000-9000-0000000000d2', 'Wei Jie Lim', '+65 6000 0104', 'weijie@goldencrust.example', '2026-10-19 09:00+08'),
  ('00000000-0000-4000-9000-0000000000d3', 'Ravi Kumar', '+65 6000 0204', 'ravi@islandspice.example', '2026-10-05 09:00+08');

insert into public.memberships (user_id, organisation_id, created_at) values
  ('00000000-0000-4000-9000-0000000000d1', '00000000-0000-4000-8000-0000000000d1', '2026-10-12 09:00+08'),
  ('00000000-0000-4000-9000-0000000000d2', '00000000-0000-4000-8000-0000000000d2', '2026-10-19 09:00+08'),
  ('00000000-0000-4000-9000-0000000000d3', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08');

insert into public.buyer_settings (organisation_id, trading_hours, weekly_budget) values
  ('00000000-0000-4000-8000-0000000000d1', 'Daily, 10:00 to 21:30', 700),
  ('00000000-0000-4000-8000-0000000000d2', 'Tue to Sun, 06:00 to 18:00', 650);

-- Monday to Friday (ISO 1 to 5), order by 15:00, next-day delivery, minimum order S$40.
insert into public.supplier_profiles (organisation_id, product_range, delivery_days, lead_time_days, lead_time_note, cutoff_time, minimum_order, bank_last4) values
  ('00000000-0000-4000-8000-0000000000d3', 'Spices, aromatics, coconut milk, palm sugar', '{1,2,3,4,5}', 1, null, '15:00', 40, '7315');

insert into public.trading_connections (buyer_org_id, supplier_org_id, status, created_at) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', 'active', '2026-10-12 09:00+08'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c2', 'active', '2026-10-12 09:00+08'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d3', 'active', '2026-10-12 09:00+08'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c1', 'active', '2026-10-19 09:00+08'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c2', 'active', '2026-10-19 09:00+08'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d3', 'active', '2026-10-19 09:00+08'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000d3', 'active', '2026-10-20 10:00+08'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000d3', 'active', '2026-10-20 10:00+08');

insert into public.products (id, supplier_org_id, sku, name, unit, price, category, art, pack_kg, reorder_level, aliases, status, added_by_org_id, created_at) values
  ('00000000-0000-4000-8000-000000000d01', '00000000-0000-4000-8000-0000000000d3', 'IS-3001', 'Turmeric powder 1kg', 'pack', 9.80, 'dry_goods', 'packet', 1, 10, '{turmeric powder,turmeric,kunyit}', 'active', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08'),
  ('00000000-0000-4000-8000-000000000d02', '00000000-0000-4000-8000-0000000000d3', 'IS-3002', 'Curry powder 1kg', 'pack', 11.50, 'dry_goods', 'packet', 1, 10, '{curry powder,curry}', 'active', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08'),
  ('00000000-0000-4000-8000-000000000d03', '00000000-0000-4000-8000-0000000000d3', 'IS-3003', 'Dried chillies 500g', 'packet', 6.40, 'dry_goods', 'packet', 0.5, 12, '{dried chillies,dried chilli,chilli kering}', 'active', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08'),
  ('00000000-0000-4000-8000-000000000d04', '00000000-0000-4000-8000-0000000000d3', 'IS-3004', 'Coconut milk 400ml', 'tin', 1.85, 'dry_goods', 'tin', null, 48, '{coconut milk,santan}', 'active', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08'),
  ('00000000-0000-4000-8000-000000000d05', '00000000-0000-4000-8000-0000000000d3', 'IS-3005', 'Garlic 1kg', 'bag', 5.20, 'fresh', 'leaf', 1, 15, '{garlic,bawang putih}', 'active', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08'),
  ('00000000-0000-4000-8000-000000000d06', '00000000-0000-4000-8000-0000000000d3', 'IS-3006', 'Ginger 1kg', 'bag', 4.80, 'fresh', 'leaf', 1, 15, '{ginger,halia}', 'active', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08'),
  ('00000000-0000-4000-8000-000000000d07', '00000000-0000-4000-8000-0000000000d3', 'IS-3007', 'Star anise 250g', 'packet', 7.90, 'dry_goods', 'packet', 0.25, 8, '{star anise,bunga lawang}', 'active', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08'),
  ('00000000-0000-4000-8000-000000000d08', '00000000-0000-4000-8000-0000000000d3', 'IS-3008', 'Palm sugar 500g', 'pack', 3.60, 'dry_goods', 'sack', 0.5, 20, '{palm sugar,gula melaka}', 'active', '00000000-0000-4000-8000-0000000000d3', '2026-10-05 09:00+08');

insert into public.inventory_levels (product_id)
select p.id from public.products p where p.supplier_org_id = '00000000-0000-4000-8000-0000000000d3';

-- Opening stock through the stock history helper (as supplier_add_product does): one 'received' row per product with
-- reason opening_stock, actor Ravi. Dried chillies (10) are all taken by M02 and M08, so they end out of
-- stock; star anise (14) ends low after M13 reserves 6.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d3', 'role', 'authenticated')::text, true);
select app.move_stock(p.id, 'received', t.qty, 0, null, 'opening_stock', 'Opening stock')
from (values
  ('IS-3001', 40), ('IS-3002', 35), ('IS-3003', 10), ('IS-3004', 240),
  ('IS-3005', 50), ('IS-3006', 45), ('IS-3007', 14), ('IS-3008', 60)
) t(sku, qty)
join public.products p on p.sku = t.sku and p.supplier_org_id = '00000000-0000-4000-8000-0000000000d3'
order by p.id;

-- Usual items. in_shop is set to its final value in step 9, after deliveries have added to it.
insert into public.usual_items (buyer_org_id, product_id, usual_qty, use_per_day, in_shop, last_paid)
select ('00000000-0000-4000-8000-0000000000' || u.buyer)::uuid, p.id, u.qty, u.use_per_day, 0, p.price
from (values
  ('d1', 'FL-2020', 30, 10), ('d1', 'DG-1030', 12, 3), ('d1', 'DG-1010', 3, 0.6),
  ('d1', 'IS-3004', 24, 4), ('d1', 'IS-3001', 2, 0.25), ('d1', 'IS-3006', 3, 0.8),
  ('d2', 'FL-2001', 2, 0.6), ('d2', 'DG-1050', 8, 2), ('d2', 'DG-1020', 12, 5),
  ('d2', 'IS-3008', 10, 2), ('d2', 'IS-3004', 24, 4), ('d2', 'DG-1010', 2, 0.4)
) u(buyer, sku, qty, use_per_day)
join public.products p on p.sku = u.sku;

commit;

-- 2. Orders placed by the buyers, oldest first so order numbers follow time ---------------------------------
-- Products: DG-1001 ...101 rice, DG-1010 ...103 oil, DG-1020 ...105 evaporated milk, DG-1030 ...106 noodles,
-- DG-1050 ...108 sugar, FL-2001 ...109 eggs, FL-2010 ...110 chilli paste, FL-2020 ...111 tofu,
-- FL-2030 ...112 spring onion, IS-3001 to IS-3008 ...d01 to ...d08.

begin;
set local role authenticated;

-- Siti Rahim, Lotus Leaf Vegetarian
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d1', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000106","qty":10},{"productId":"00000000-0000-4000-8000-000000000103","qty":2}]', null, '00000000-0000-4000-a000-000000000101');
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000d04","qty":24},{"productId":"00000000-0000-4000-8000-000000000d01","qty":2},{"productId":"00000000-0000-4000-8000-000000000d03","qty":4}]', null, '00000000-0000-4000-a000-000000000102');

-- Wei Jie Lim, Golden Crust Bakery
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d2', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000108","qty":8},{"productId":"00000000-0000-4000-8000-000000000105","qty":12}]', null, '00000000-0000-4000-a000-000000000103');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d1', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000111","qty":30},{"productId":"00000000-0000-4000-8000-000000000112","qty":2}]', null, '00000000-0000-4000-a000-000000000104');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d2', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000109","qty":2}]', null, '00000000-0000-4000-a000-000000000105');
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000d08","qty":10},{"productId":"00000000-0000-4000-8000-000000000d04","qty":24}]', null, '00000000-0000-4000-a000-000000000106');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d1', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000106","qty":12},{"productId":"00000000-0000-4000-8000-000000000101","qty":2}]', null, '00000000-0000-4000-a000-000000000107');
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000d03","qty":6},{"productId":"00000000-0000-4000-8000-000000000d06","qty":3}]', null, '00000000-0000-4000-a000-000000000108');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d2', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000103","qty":2},{"productId":"00000000-0000-4000-8000-000000000108","qty":4}]', null, '00000000-0000-4000-a000-000000000109');
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000108","qty":8},{"productId":"00000000-0000-4000-8000-000000000105","qty":12}]', null, '00000000-0000-4000-a000-000000000110');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d1', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000111","qty":15},{"productId":"00000000-0000-4000-8000-000000000110","qty":1}]', null, '00000000-0000-4000-a000-000000000111');
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000103","qty":3},{"productId":"00000000-0000-4000-8000-000000000101","qty":2}]', null, '00000000-0000-4000-a000-000000000112');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d2', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000d07","qty":12},{"productId":"00000000-0000-4000-8000-000000000d04","qty":24}]', null, '00000000-0000-4000-a000-000000000113');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d1', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000d01","qty":2},{"productId":"00000000-0000-4000-8000-000000000d02","qty":2},{"productId":"00000000-0000-4000-8000-000000000d05","qty":3}]', null, '00000000-0000-4000-a000-000000000114');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d2', 'role', 'authenticated')::text, true);
select public.place_orders('[{"productId":"00000000-0000-4000-8000-000000000d04","qty":12},{"productId":"00000000-0000-4000-8000-000000000d06","qty":2}]', null, '00000000-0000-4000-a000-000000000115');

commit;

-- Steps 3 to 7 start by copying each mock order id into a transaction setting (mock.m01 to mock.m15) while
-- still the database owner, because idempotency_keys is not readable by the authenticated role.

-- 3. Suppliers accept, part accept or reject ------------------------------------------------------------------
-- Delivery dates passed here are today; step 9 sets the real (earlier) delivery dates.

begin;
select set_config('mock.m' || right(k.key::text, 2), k.result -> 'orders' -> 0 ->> 'id', true)
from public.idempotency_keys k
where k.action = 'place_orders' and k.key::text like '00000000-0000-4000-a000-0000000001__';
set local role authenticated;

-- Priya Nair, Harbour Dry Goods
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000c1', 'role', 'authenticated')::text, true);
select public.accept_order(current_setting('mock.m01')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000201');
select public.accept_order(current_setting('mock.m03')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000203');
select public.accept_order(current_setting('mock.m07')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000207');
select public.accept_order(current_setting('mock.m09')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000209');
select public.accept_order(current_setting('mock.m10')::uuid, (now() at time zone 'Asia/Singapore')::date + 1, '00000000-0000-4000-a000-000000000210');
select public.accept_order(current_setting('mock.m12')::uuid, (now() at time zone 'Asia/Singapore')::date + 1, '00000000-0000-4000-a000-000000000212');

-- Daniel Koh, Fresh Lane Produce
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000c2', 'role', 'authenticated')::text, true);
select public.reject_order(current_setting('mock.m04')::uuid, '00000000-0000-4000-a000-000000000204');
select public.accept_order(current_setting('mock.m05')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000205');
select public.accept_order(current_setting('mock.m11')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000211');

-- Ravi Kumar, Island Spice Traders
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d3', 'role', 'authenticated')::text, true);
select public.accept_order(current_setting('mock.m02')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000202');
select public.accept_order(current_setting('mock.m06')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000206');
select public.accept_order(current_setting('mock.m08')::uuid, (now() at time zone 'Asia/Singapore')::date, '00000000-0000-4000-a000-000000000208');
-- Only 6 of the 12 star anise can be sent; the coconut milk line is left out, so it keeps its full quantity.
select public.part_accept_order(current_setting('mock.m13')::uuid,
  '[{"productId":"00000000-0000-4000-8000-000000000d07","sendQty":6}]', (now() at time zone 'Asia/Singapore')::date + 1,
  '00000000-0000-4000-a000-000000000213');

commit;

-- 4. Out for delivery ------------------------------------------------------------------------------------------

begin;
select set_config('mock.m' || right(k.key::text, 2), k.result -> 'orders' -> 0 ->> 'id', true)
from public.idempotency_keys k
where k.action = 'place_orders' and k.key::text like '00000000-0000-4000-a000-0000000001__';
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000c1', 'role', 'authenticated')::text, true);
select public.mark_out_for_delivery(current_setting('mock.m01')::uuid, '00000000-0000-4000-a000-000000000301');
select public.mark_out_for_delivery(current_setting('mock.m03')::uuid, '00000000-0000-4000-a000-000000000303');
select public.mark_out_for_delivery(current_setting('mock.m07')::uuid, '00000000-0000-4000-a000-000000000307');
select public.mark_out_for_delivery(current_setting('mock.m09')::uuid, '00000000-0000-4000-a000-000000000309');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000c2', 'role', 'authenticated')::text, true);
select public.mark_out_for_delivery(current_setting('mock.m05')::uuid, '00000000-0000-4000-a000-000000000305');
select public.mark_out_for_delivery(current_setting('mock.m11')::uuid, '00000000-0000-4000-a000-000000000311');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d3', 'role', 'authenticated')::text, true);
select public.mark_out_for_delivery(current_setting('mock.m02')::uuid, '00000000-0000-4000-a000-000000000302');
select public.mark_out_for_delivery(current_setting('mock.m06')::uuid, '00000000-0000-4000-a000-000000000306');
select public.mark_out_for_delivery(current_setting('mock.m08')::uuid, '00000000-0000-4000-a000-000000000308');

commit;

-- 5. Delivered (M02 is delivered by the buyer's check in step 6) ----------------------------------------------

begin;
select set_config('mock.m' || right(k.key::text, 2), k.result -> 'orders' -> 0 ->> 'id', true)
from public.idempotency_keys k
where k.action = 'place_orders' and k.key::text like '00000000-0000-4000-a000-0000000001__';
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000c1', 'role', 'authenticated')::text, true);
select public.mark_delivered(current_setting('mock.m01')::uuid, '00000000-0000-4000-a000-000000000401');
select public.mark_delivered(current_setting('mock.m03')::uuid, '00000000-0000-4000-a000-000000000403');
select public.mark_delivered(current_setting('mock.m07')::uuid, '00000000-0000-4000-a000-000000000407');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000c2', 'role', 'authenticated')::text, true);
select public.mark_delivered(current_setting('mock.m05')::uuid, '00000000-0000-4000-a000-000000000405');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d3', 'role', 'authenticated')::text, true);
select public.mark_delivered(current_setting('mock.m06')::uuid, '00000000-0000-4000-a000-000000000406');

commit;

-- 6. Buyers check deliveries, report problems and a late delivery ----------------------------------------------

begin;
select set_config('mock.m' || right(k.key::text, 2), k.result -> 'orders' -> 0 ->> 'id', true)
from public.idempotency_keys k
where k.action = 'place_orders' and k.key::text like '00000000-0000-4000-a000-0000000001__';
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d1', 'role', 'authenticated')::text, true);
select public.confirm_all_here(current_setting('mock.m01')::uuid, '00000000-0000-4000-a000-000000000501');
select public.confirm_all_here(current_setting('mock.m02')::uuid, '00000000-0000-4000-a000-000000000502');
select public.report_problem(current_setting('mock.m07')::uuid, '00000000-0000-4000-8000-000000000106', 'short', 3,
  'Only 9 packets of noodles in the box', '00000000-0000-4000-a000-000000000507');
select public.report_not_here(current_setting('mock.m11')::uuid, '00000000-0000-4000-a000-000000000511');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d2', 'role', 'authenticated')::text, true);
select public.confirm_all_here(current_setting('mock.m03')::uuid, '00000000-0000-4000-a000-000000000503');
select public.report_problem(current_setting('mock.m05')::uuid, '00000000-0000-4000-8000-000000000109', 'damaged', 1,
  'One carton of eggs was crushed in transit', '00000000-0000-4000-a000-000000000505');
select public.report_problem(current_setting('mock.m06')::uuid, '00000000-0000-4000-8000-000000000d08', 'wrong_item', 4,
  '4 packs were brown sugar, not palm sugar', '00000000-0000-4000-a000-000000000506');

commit;

-- 7. Suppliers answer: a credit from Fresh Lane, a dispute from Island Spice for Tradelink to resolve -------------

begin;
select set_config('mock.i' || right(k.key::text, 2), k.result ->> 'issueId', true)
from public.idempotency_keys k
where k.action = 'report_problem' and k.key::text like '00000000-0000-4000-a000-0000000005__';
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000c2', 'role', 'authenticated')::text, true);
select public.answer_issue(current_setting('mock.i05')::uuid, 'credit', '00000000-0000-4000-a000-000000000605');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d3', 'role', 'authenticated')::text, true);
select public.answer_issue(current_setting('mock.i06')::uuid, 'dispute', '00000000-0000-4000-a000-000000000606');

commit;

-- 8. Price changes by Ravi on two of the new buyers' usual items ---------------------------------------------------

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d3', 'role', 'authenticated')::text, true);
select public.change_price('00000000-0000-4000-8000-000000000d04', 1.95, '00000000-0000-4000-a000-000000000701');
select public.change_price('00000000-0000-4000-8000-000000000d08', 3.80, '00000000-0000-4000-a000-000000000702');
commit;

-- 9. Backdating and final shop counts (plain updates on tables that allow them) -------------------------------------

begin;

create temporary table mock_plan (
  n text primary key, order_id uuid,
  placed timestamptz, decided timestamptz, out_at timestamptz, delivered timestamptz, checked timestamptz,
  issue_at timestamptz, answered timestamptz, delivery_date date
) on commit drop;

-- decided is accepted, part accepted or rejected; checked is all here or the problem report.
insert into mock_plan (n, placed, decided, out_at, delivered, checked, issue_at, answered, delivery_date) values
  ('01', '2026-10-25 20:10+08', '2026-10-26 07:30+08', '2026-10-26 08:40+08', '2026-10-26 10:00+08', '2026-10-26 10:20+08', null, null, '2026-10-26'),
  ('02', '2026-10-26 14:20+08', '2026-10-26 14:45+08', '2026-10-27 08:30+08', '2026-10-27 10:30+08', '2026-10-27 10:30+08', null, null, '2026-10-27'),
  ('03', '2026-10-27 15:10+08', '2026-10-27 15:40+08', '2026-10-28 08:00+08', '2026-10-28 09:40+08', '2026-10-28 10:05+08', null, null, '2026-10-28'),
  ('04', '2026-10-28 07:30+08', '2026-10-28 08:05+08', null, null, null, null, null, null),
  ('05', '2026-10-29 06:50+08', '2026-10-29 07:05+08', '2026-10-29 09:30+08', '2026-10-29 11:20+08', '2026-10-29 11:45+08', '2026-10-29 11:45+08', '2026-10-29 14:10+08', '2026-10-29'),
  ('06', '2026-10-30 13:00+08', '2026-10-30 13:40+08', '2026-11-02 08:30+08', '2026-11-02 10:15+08', '2026-11-02 10:40+08', '2026-11-02 10:40+08', '2026-11-02 15:20+08', '2026-11-02'),
  ('07', '2026-10-31 09:00+08', '2026-10-31 09:30+08', '2026-11-02 08:10+08', '2026-11-02 09:30+08', '2026-11-02 10:00+08', '2026-11-02 10:00+08', null, '2026-11-02'),
  ('08', '2026-11-02 14:10+08', '2026-11-02 14:40+08', '2026-11-03 09:15+08', null, null, null, null, '2026-11-03'),
  ('09', '2026-11-02 15:00+08', '2026-11-02 15:20+08', '2026-11-03 13:30+08', null, null, null, null, '2026-11-03'),
  ('10', '2026-11-02 17:20+08', '2026-11-03 08:35+08', null, null, null, null, null, '2026-11-04'),
  ('11', '2026-11-03 06:20+08', '2026-11-03 06:35+08', '2026-11-03 08:00+08', null, null, '2026-11-03 11:30+08', null, '2026-11-03'),
  ('12', '2026-11-03 07:40+08', '2026-11-03 08:30+08', null, null, null, null, null, '2026-11-04'),
  ('13', '2026-11-03 09:10+08', '2026-11-03 09:50+08', null, null, null, null, null, '2026-11-04'),
  ('14', '2026-11-03 17:30+08', null, null, null, null, null, null, null),
  ('15', '2026-11-03 18:05+08', null, null, null, null, null, null, null);

update mock_plan p set order_id = (k.result -> 'orders' -> 0 ->> 'id')::uuid
from public.idempotency_keys k
where k.action = 'place_orders' and k.key = ('00000000-0000-4000-a000-0000000001' || p.n)::uuid;

update public.orders o
set created_at = p.placed,
    updated_at = coalesce(p.checked, p.delivered, p.out_at, p.decided, p.placed),
    delivered_at = p.delivered,
    confirmed_delivery_date = case when o.status in ('accepted', 'out_for_delivery', 'delivered') then p.delivery_date end
from mock_plan p
where o.id = p.order_id;

update public.issues i
set created_at = p.issue_at,
    answered_at = case when i.answered_at is not null then p.answered end
from mock_plan p
where i.order_id = p.order_id;

update public.partial_fulfilments f set created_at = p.decided
from mock_plan p
where f.order_id = p.order_id;

update public.notifications n
set created_at = case n.kind
      when 'New order' then p.placed
      when 'Order accepted' then p.decided
      when 'Order part accepted' then p.decided
      when 'Order rejected' then p.decided
      when 'Out for delivery' then p.out_at
      when 'Order delivered' then p.delivered
    end
from mock_plan p
where n.link = '/orders/' || p.order_id
  and n.kind in ('New order', 'Order accepted', 'Order part accepted', 'Order rejected', 'Out for delivery', 'Order delivered');

-- Acceptance messages name the delivery date passed at accept time (today); use the planned date instead.
update public.notifications n
set body = regexp_replace(n.body, 'for delivery on .*\.$', 'for delivery on ' || to_char(p.delivery_date, 'Dy FMDD Mon') || '.')
from mock_plan p
where n.link = '/orders/' || p.order_id and n.kind = 'Order accepted';

update public.notifications n
set created_at = case when n.kind in ('Problem reported', 'Delivery late') then p.issue_at else p.answered end
from mock_plan p
join public.issues i on i.order_id = p.order_id
where n.link = '/issues/' || i.id;

-- Notifications from these orders that are more than two days old have been read.
update public.notifications n
set read_at = n.created_at + interval '2 hours'
from mock_plan p
left join public.issues i on i.order_id = p.order_id
where (n.link = '/orders/' || p.order_id or n.link = '/issues/' || i.id)
  and n.read_at is null and n.created_at < now() - interval '2 days';

-- What is in each shop now. With the open orders this puts 2 items in Lotus Leaf's Ready for tomorrow
-- (firm tofu, dried noodles) and 3 in Golden Crust's (eggs, evaporated milk, palm sugar).
update public.usual_items u set in_shop = s.in_shop
from (values
  ('d1', 'FL-2020', 12), ('d1', 'DG-1030', 4), ('d1', 'DG-1010', 1),
  ('d1', 'IS-3004', 30), ('d1', 'IS-3001', 1), ('d1', 'IS-3006', 0.5),
  ('d2', 'FL-2001', 1), ('d2', 'DG-1050', 4), ('d2', 'DG-1020', 2),
  ('d2', 'IS-3008', 4), ('d2', 'IS-3004', 6), ('d2', 'DG-1010', 0.5)
) s(buyer, sku, in_shop)
join public.products p on p.sku = s.sku
where u.buyer_org_id = ('00000000-0000-4000-8000-0000000000' || s.buyer)::uuid and u.product_id = p.id;

commit;

-- 10. Checks (read only) --------------------------------------------------------------------------------------------

-- Stock history invariant: expect no rows.
select p.sku, i.on_hand, i.reserved, sum(m.on_hand_change) as history_on_hand, sum(m.reserved_change) as history_reserved
from public.products p
join public.inventory_levels i on i.product_id = p.id
left join public.stock_movements m on m.product_id = p.id
group by p.sku, i.on_hand, i.reserved
having i.on_hand <> coalesce(sum(m.on_hand_change), 0) or i.reserved <> coalesce(sum(m.reserved_change), 0);

-- Siti sees only Lotus Leaf orders; Ravi sees only orders to Island Spice; Hannah sees the dispute.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d1', 'role', 'authenticated')::text, true);
select 'siti' as viewer, count(*) as orders, count(*) filter (where buyer_org_id <> '00000000-0000-4000-8000-0000000000d1') as not_hers
from public.orders;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000d3', 'role', 'authenticated')::text, true);
select 'ravi' as viewer, count(*) as orders, count(*) filter (where supplier_org_id <> '00000000-0000-4000-8000-0000000000d3') as not_his
from public.orders;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-9000-0000000000a1', 'role', 'authenticated')::text, true);
select item_key, priority, type, title, detail from public.v_attention where type = 'Dispute';
commit;
