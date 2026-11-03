-- Tradelink AI demo data (M0). Fictional shop, people and prices; products use real brand names only as
-- catalogue examples. Demo password for every account: Tradelink-demo-2026. Phone sign-in arrives in M1.
-- Safe to run once on an empty Tradelink AI schema.

with people (id, email, full_name, phone) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'tan@kopicorner.example', 'Tan Wei Ming', '+6591000001'),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'ali@kopicorner.example', 'Ali Hassan', '+6591000002'),
    ('00000000-0000-4000-a000-000000000003'::uuid, 'ahhuat@ahhuat.example', 'Lim Ah Huat', '+6591000003'),
    ('00000000-0000-4000-a000-000000000004'::uuid, 'sales@kltrading.example', 'Kumar Letchumanan', '+6591000004'),
    ('00000000-0000-4000-a000-000000000005'::uuid, 'orders@freshpoultry.example', 'Grace Ong', '+6591000005'),
    ('00000000-0000-4000-a000-000000000006'::uuid, 'ops@tradelink-ai.example', 'Nadia Ops', '+6591000006')
), new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email,
    extensions.crypt('Tradelink-demo-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p.full_name), now(), now(),
    '', '', '', ''
  from people p
  returning id, email
), identities as (
  insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', null, now(), now()
  from new_users u
  returning user_id
)
insert into public.app_user (id, phone, full_name, default_mode)
select p.id, p.phone, p.full_name,
  case when p.email like 'tan@%' or p.email like 'ali@%' then 'shop' when p.email like 'ops@%' then 'ops' else 'supplier' end
from people p join identities i on i.user_id = p.id;

insert into public.ops_member (user_id, role) values ('00000000-0000-4000-a000-000000000006', 'admin');

insert into public.shop (id, name, status, address, postal_code, rest_day, licence_tobacco, activation_status) values
  ('00000000-0000-4000-b000-000000000001', 'Kopi Corner', 'LIVE', 'Blk 201 Tampines Street 21, #01-1234', '521201', 7, true, 'ACTIVE');
insert into public.outlet (shop_id, name, address) values
  ('00000000-0000-4000-b000-000000000001', 'Tampines', 'Blk 201 Tampines Street 21, #01-1234');

insert into public.shop_member (shop_id, user_id, role, status, confirm_cap_cents) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'owner', 'ACTIVE', null),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'staff', 'ACTIVE', 20000);

insert into public.supplier (id, name, phone, verified) values
  ('00000000-0000-4000-c000-000000000001', 'Ah Huat Trading', '+6561000001', true),
  ('00000000-0000-4000-c000-000000000002', 'KL Trading', '+6561000002', true),
  ('00000000-0000-4000-c000-000000000003', 'FreshPoultry', '+6561000003', true);
insert into public.supplier_member (supplier_id, user_id) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-a000-000000000005');

insert into public.shop_supplier (shop_id, supplier_id, status, cut_off, delivery_days, delivery_window_start, delivery_window_end,
  minimum_order_cents, delivery_fee_cents, free_delivery_at_cents, payment_terms, order_channel, ack_at) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001', 'LIVE', '18:00', '{1,3,5}', '07:00', '09:00', 5000, null, null, 'cod', 'app', now()),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000002', 'LIVE', '17:00', '{2,4,6}', '14:00', '17:00', 8000, 1500, 15000, '14d', 'app', now()),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000003', 'PENDING', '20:00', '{1,2,3,4,5,6}', '09:00', '11:00', 3000, null, null, '7d', 'web_link', null);

insert into public.product (id, brand, name, variant, pack_size, base_unit, pack_qty, category, halal) values
  ('00000000-0000-4000-d000-000000000001', 'Seng Choon', 'Eggs', 'Fresh', 'tray of 30', 'egg', 30, 'eggs', true),
  ('00000000-0000-4000-d000-000000000002', 'Meiji', 'Fresh milk', null, '2L', 'bottle', 1, 'dairy', true),
  ('00000000-0000-4000-d000-000000000003', 'Meiji', 'Low fat milk', null, '2L', 'bottle', 1, 'dairy', true),
  ('00000000-0000-4000-d000-000000000004', 'Gardenia', 'White loaf', 'Classic', '600g', 'loaf', 1, 'bakery', true),
  ('00000000-0000-4000-d000-000000000005', 'Gardenia', 'Wholemeal loaf', null, '400g', 'loaf', 1, 'bakery', true),
  ('00000000-0000-4000-d000-000000000006', null, 'Toor dal', null, '1kg', 'bag', 1, 'dry goods', true),
  ('00000000-0000-4000-d000-000000000007', 'MDH', 'Chaat masala', null, '100g', 'box', 1, 'spices', true),
  ('00000000-0000-4000-d000-000000000008', 'LKK', 'Oyster sauce', null, '2.27kg', 'tin', 1, 'sauces', null),
  ('00000000-0000-4000-d000-000000000009', null, 'Cooking oil', 'Palm', '17L tin', 'tin', 1, 'oil', true),
  ('00000000-0000-4000-d000-000000000010', 'CP', 'Chicken mid-wing', 'Frozen', '1kg pack', 'kg', 1, 'poultry', true),
  ('00000000-0000-4000-d000-000000000011', null, 'Jasmine rice', 'Thai', '10kg bag', 'bag', 1, 'rice', true),
  ('00000000-0000-4000-d000-000000000012', 'Maggi', 'Chilli sauce', null, '3.2kg', 'bottle', 1, 'sauces', true),
  ('00000000-0000-4000-d000-000000000013', null, 'Bean sprouts', 'Fresh', 'per kg', 'kg', 1, 'vegetables', true),
  ('00000000-0000-4000-d000-000000000014', 'Mentos', 'Mint rolls', null, 'box of 40', 'box', 1, 'snacks', true);

insert into public.list_version (shop_id, n, status, locked_at, locked_by) values
  ('00000000-0000-4000-b000-000000000001', 1, 'LOCKED', now(), '00000000-0000-4000-a000-000000000001');

-- Kopi Corner's locked list: item, supplier, order unit, billing type, nicknames.
insert into public.shop_item (id, shop_id, product_id, supplier_id, order_unit, base_unit, base_per_order, billing_type, nicknames, confirmed_words, status, shelf_life_days)
select v.id::uuid, '00000000-0000-4000-b000-000000000001', v.product::uuid, v.supplier::uuid, v.unit, v.base, v.per, v.billing, v.nick::text[], v.words::text[], 'ORDERABLE', v.shelf
from (values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000001', 'tray', 'egg', 30, 'fixed', '{"egg tray"}', '{"eggs","egg"}', 21),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000002', 'bottle', 'bottle', 1, 'fixed', '{}', '{}', 10),
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-d000-000000000003', '00000000-0000-4000-c000-000000000002', 'bottle', 'bottle', 1, 'fixed', '{}', '{}', 10),
  ('00000000-0000-4000-e000-000000000004', '00000000-0000-4000-d000-000000000004', '00000000-0000-4000-c000-000000000002', 'loaf', 'loaf', 1, 'fixed', '{}', '{}', 5),
  ('00000000-0000-4000-e000-000000000005', '00000000-0000-4000-d000-000000000005', '00000000-0000-4000-c000-000000000002', 'loaf', 'loaf', 1, 'fixed', '{}', '{}', 5),
  ('00000000-0000-4000-e000-000000000006', '00000000-0000-4000-d000-000000000006', '00000000-0000-4000-c000-000000000002', 'bag', 'kg', 1, 'fixed', '{"dal"}', '{}', 180),
  ('00000000-0000-4000-e000-000000000008', '00000000-0000-4000-d000-000000000008', '00000000-0000-4000-c000-000000000001', 'tin', 'kg', 2.27, 'fixed', '{"oyster"}', '{}', 365),
  ('00000000-0000-4000-e000-000000000009', '00000000-0000-4000-d000-000000000009', '00000000-0000-4000-c000-000000000002', 'tin', 'L', 17, 'fixed', '{"oil"}', '{}', 365),
  ('00000000-0000-4000-e000-000000000010', '00000000-0000-4000-d000-000000000010', '00000000-0000-4000-c000-000000000003', 'kg', 'kg', 1, 'per_kg', '{"wing","wings"}', '{}', 90),
  ('00000000-0000-4000-e000-000000000011', '00000000-0000-4000-d000-000000000011', '00000000-0000-4000-c000-000000000001', 'bag', 'kg', 10, 'fixed', '{"rice"}', '{}', 365),
  ('00000000-0000-4000-e000-000000000013', '00000000-0000-4000-d000-000000000013', '00000000-0000-4000-c000-000000000001', 'kg', 'kg', 1, 'per_kg', '{"taugeh"}', '{}', 2),
  ('00000000-0000-4000-e000-000000000014', '00000000-0000-4000-d000-000000000014', '00000000-0000-4000-c000-000000000002', 'box', 'box', 1, 'fixed', '{"candy"}', '{}', 365)
) as v (id, product, supplier, unit, base, per, billing, nick, words, shelf);

-- Prices he has paid (onboarding invoices), and the expected range built from them.
insert into public.price_observation (shop_id, shop_item_id, supplier_id, price_cents, unit, source, observed_at)
select '00000000-0000-4000-b000-000000000001', i.id, i.supplier_id, v.cents, i.order_unit, 'onboarding', now() - (v.days || ' days')::interval
from (values
  ('00000000-0000-4000-e000-000000000001', 540, 5), ('00000000-0000-4000-e000-000000000001', 530, 12),
  ('00000000-0000-4000-e000-000000000002', 410, 6), ('00000000-0000-4000-e000-000000000003', 395, 20),
  ('00000000-0000-4000-e000-000000000004', 280, 4), ('00000000-0000-4000-e000-000000000005', 310, 25),
  ('00000000-0000-4000-e000-000000000006', 320, 9), ('00000000-0000-4000-e000-000000000008', 1210, 15),
  ('00000000-0000-4000-e000-000000000009', 4580, 10), ('00000000-0000-4000-e000-000000000009', 4450, 24),
  ('00000000-0000-4000-e000-000000000010', 680, 3), ('00000000-0000-4000-e000-000000000011', 1890, 14),
  ('00000000-0000-4000-e000-000000000013', 180, 2), ('00000000-0000-4000-e000-000000000014', 1450, 30)
) as v (item, cents, days)
join public.shop_item i on i.id = v.item::uuid;

insert into public.expected_price (shop_item_id, supplier_id, shop_id, low_cents, high_cents, last_paid_cents, basis, n_observations)
select o.shop_item_id, o.supplier_id, o.shop_id,
  (min(o.price_cents) * 0.95)::int, (max(o.price_cents) * 1.05)::int,
  (array_agg(o.price_cents order by o.observed_at desc))[1], 'onboarding invoices', count(*)
from public.price_observation o
where o.shop_id = '00000000-0000-4000-b000-000000000001'
group by o.shop_item_id, o.supplier_id, o.shop_id;

insert into public.usage_rate (shop_item_id, shop_id, per_open_day, usual_qty, n_deliveries)
select v.item::uuid, '00000000-0000-4000-b000-000000000001', v.rate, v.usual, v.n
from (values
  ('00000000-0000-4000-e000-000000000001', 1.6, 10, 6), ('00000000-0000-4000-e000-000000000002', 1.0, 6, 5),
  ('00000000-0000-4000-e000-000000000004', 0.7, 4, 5), ('00000000-0000-4000-e000-000000000006', 0.15, 1, 3),
  ('00000000-0000-4000-e000-000000000009', 0.14, 1, 4), ('00000000-0000-4000-e000-000000000010', 1.6, 10, 6),
  ('00000000-0000-4000-e000-000000000011', 0.3, 2, 4), ('00000000-0000-4000-e000-000000000013', 1.0, 2, 6)
) as v (item, rate, usual, n);

insert into public.autonomy_setting (shop_id, area, level, limit_cents) values
  ('00000000-0000-4000-b000-000000000001', 'shop_orders', 1, 5000),
  ('00000000-0000-4000-b000-000000000001', 'supplier_problems', 2, 5000);
insert into public.budget (shop_id, weekly_limit_cents) values ('00000000-0000-4000-b000-000000000001', 150000);
insert into public.chat_thread (kind, shop_id) values ('shop', '00000000-0000-4000-b000-000000000001');
insert into public.chat_thread (kind, supplier_id) values
  ('supplier', '00000000-0000-4000-c000-000000000001'),
  ('supplier', '00000000-0000-4000-c000-000000000002'),
  ('supplier', '00000000-0000-4000-c000-000000000003');

insert into public.calendar_event (kind, name, starts_on, ends_on) values
  ('public_holiday', 'Deepavali', '2026-11-08', '2026-11-08'),
  ('public_holiday', 'Christmas Day', '2026-12-25', '2026-12-25'),
  ('public_holiday', 'New Year''s Day', '2027-01-01', '2027-01-01'),
  ('public_holiday', 'Chinese New Year', '2027-02-06', '2027-02-07');
insert into public.calendar_event (kind, supplier_id, name, starts_on, ends_on) values
  ('supplier_closure', '00000000-0000-4000-c000-000000000001', 'Ah Huat closed for Chinese New Year', '2027-02-05', '2027-02-09');
