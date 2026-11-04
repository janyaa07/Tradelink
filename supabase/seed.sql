-- Tradelink demo seed. Every person and business here is fictional (design-handoff/prototype.html, ACCOUNTS and seed()).
-- Run once on a freshly migrated database. Times are relative to now(), as in the prototype ("minutes ago").
-- Demo accounts get the password you put in place of __DEMO_PASSWORD__ below; never commit a real one.
--
-- Fixed ids keep the demo reproducible:
--   organisations 00000000-0000-4000-8000-0000000000xx (b1, b2 buyers; c1, c2, c3 suppliers; a0 platform)
--   users         00000000-0000-4000-9000-0000000000xx (same suffix as the organisation, a1 to a4 for admins)
--   products      00000000-0000-4000-8000-0000000001nn (nn = prototype p1 to p13)
--   orders        00000000-0000-4000-8000-00000000nnnn (nnnn = order number)

-- Organisations ------------------------------------------------------------------------------------

insert into public.organisations (id, kind, name, status, contact_name, phone, email, address, invited_by_org_id, joined_at, created_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'buyer', 'Mei''s Noodle House', 'active', 'Mei Tan', '+65 6000 0101',
   'mei@noodlehouse.example', '21 Market Row, #01-14', null, '2025-03-03 09:00+08', '2025-03-03 09:00+08'),
  ('00000000-0000-4000-8000-0000000000b2', 'buyer', 'Seaside Kopitiam', 'active', 'Arif Rahman', '+65 6000 0102',
   'arif@seaside.example', '5 Coastal Walk, #01-02', null, '2025-07-07 09:00+08', '2025-07-07 09:00+08'),
  ('00000000-0000-4000-8000-0000000000c1', 'supplier', 'Harbour Dry Goods', 'active', 'Priya Nair', '+65 6000 0201',
   'priya@harbourdry.example', '8 Pier Lane, #02-11', null, '2025-01-06 09:00+08', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-0000000000c2', 'supplier', 'Fresh Lane Produce', 'active', 'Daniel Koh', '+65 6000 0202',
   'daniel@freshlane.example', '32 Orchard Yard, #01-07', null, '2025-02-03 09:00+08', '2025-02-03 09:00+08'),
  ('00000000-0000-4000-8000-0000000000c3', 'supplier', 'Bright Pantry Supplies', 'invited', 'Lina Ong', '+65 6000 0203',
   'lina@brightpantry.example', '14 Depot Close', '00000000-0000-4000-8000-0000000000b2', null, now() - interval '1560 minutes'),
  ('00000000-0000-4000-8000-0000000000a0', 'platform', 'Tradelink Operations', 'active', 'Hannah Lim', '+65 6000 0301',
   'hannah@tradelink.example', 'Head office', null, '2025-01-02 09:00+08', '2025-01-02 09:00+08');

-- Auth users and email identities ------------------------------------------------------------------

with people (id, email, full_name) as (
  values
    ('00000000-0000-4000-9000-0000000000b1'::uuid, 'mei@noodlehouse.example', 'Mei Tan'),
    ('00000000-0000-4000-9000-0000000000b2'::uuid, 'arif@seaside.example', 'Arif Rahman'),
    ('00000000-0000-4000-9000-0000000000c1'::uuid, 'priya@harbourdry.example', 'Priya Nair'),
    ('00000000-0000-4000-9000-0000000000c2'::uuid, 'daniel@freshlane.example', 'Daniel Koh'),
    ('00000000-0000-4000-9000-0000000000a1'::uuid, 'hannah@tradelink.example', 'Hannah Lim'),
    ('00000000-0000-4000-9000-0000000000a2'::uuid, 'farid@tradelink.example', 'Farid Ismail'),
    ('00000000-0000-4000-9000-0000000000a3'::uuid, 'grace@tradelink.example', 'Grace Chua'),
    ('00000000-0000-4000-9000-0000000000a4'::uuid, 'vikram@tradelink.example', 'Vikram Menon')
),
new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  select
    '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email,
    extensions.crypt('__DEMO_PASSWORD__', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p.full_name), now(), now(),
    '', '', '', ''
  from people p
  returning id, email
)
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', null, now(), now()
from new_users u;

insert into public.profiles (user_id, full_name, phone, email) values
  ('00000000-0000-4000-9000-0000000000b1', 'Mei Tan', '+65 6000 0101', 'mei@noodlehouse.example'),
  ('00000000-0000-4000-9000-0000000000b2', 'Arif Rahman', '+65 6000 0102', 'arif@seaside.example'),
  ('00000000-0000-4000-9000-0000000000c1', 'Priya Nair', '+65 6000 0201', 'priya@harbourdry.example'),
  ('00000000-0000-4000-9000-0000000000c2', 'Daniel Koh', '+65 6000 0202', 'daniel@freshlane.example'),
  ('00000000-0000-4000-9000-0000000000a1', 'Hannah Lim', '+65 6000 0301', 'hannah@tradelink.example'),
  ('00000000-0000-4000-9000-0000000000a2', 'Farid Ismail', '+65 6000 0302', 'farid@tradelink.example'),
  ('00000000-0000-4000-9000-0000000000a3', 'Grace Chua', '+65 6000 0303', 'grace@tradelink.example'),
  ('00000000-0000-4000-9000-0000000000a4', 'Vikram Menon', '+65 6000 0304', 'vikram@tradelink.example');

insert into public.memberships (user_id, organisation_id) values
  ('00000000-0000-4000-9000-0000000000b1', '00000000-0000-4000-8000-0000000000b1'),
  ('00000000-0000-4000-9000-0000000000b2', '00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-9000-0000000000c1', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-9000-0000000000c2', '00000000-0000-4000-8000-0000000000c2'),
  ('00000000-0000-4000-9000-0000000000a1', '00000000-0000-4000-8000-0000000000a0'),
  ('00000000-0000-4000-9000-0000000000a2', '00000000-0000-4000-8000-0000000000a0'),
  ('00000000-0000-4000-9000-0000000000a3', '00000000-0000-4000-8000-0000000000a0'),
  ('00000000-0000-4000-9000-0000000000a4', '00000000-0000-4000-8000-0000000000a0');

insert into public.buyer_settings (organisation_id, trading_hours, weekly_budget) values
  ('00000000-0000-4000-8000-0000000000b1', 'Daily, 07:00 to 21:00', 900),
  ('00000000-0000-4000-8000-0000000000b2', 'Daily, 06:30 to 19:00', 900);

-- Delivery days use ISO numbering: 1 is Monday, 7 is Sunday. Bright Pantry has not provided terms yet.
insert into public.supplier_profiles (organisation_id, product_range, delivery_days, lead_time_days, lead_time_note, cutoff_time, minimum_order, bank_last4) values
  ('00000000-0000-4000-8000-0000000000c1', 'Rice, oil, noodles, dry goods', '{1,2,3,4,5,6}', 1, null, '16:00', 50, '4821'),
  ('00000000-0000-4000-8000-0000000000c2', 'Eggs, tofu, fresh produce', '{1,2,3,4,5,6,7}', 0, 'Same day before 10:00', '14:00', 30, '6630');

insert into public.admin_profiles (user_id, team, shift) values
  ('00000000-0000-4000-9000-0000000000a1', 'Operations lead', 'Mon to Fri, 09:00 to 18:00'),
  ('00000000-0000-4000-9000-0000000000a2', 'Supplier onboarding', 'Mon to Fri, 09:00 to 18:00'),
  ('00000000-0000-4000-9000-0000000000a3', 'Order desk', 'Daily, 06:00 to 14:00'),
  ('00000000-0000-4000-9000-0000000000a4', 'Customer support', 'Daily, 14:00 to 22:00');

-- Hannah leads operations: she sees and assigns the whole attention queue.
update public.admin_profiles set is_lead = true where user_id = '00000000-0000-4000-9000-0000000000a1';

insert into public.trading_connections (buyer_org_id, supplier_org_id, status, created_at) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', 'active', '2025-03-03 09:00+08'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c2', 'active', '2025-03-03 09:00+08'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c1', 'active', '2025-07-07 09:00+08'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c2', 'active', '2025-07-07 09:00+08'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c3', 'invited', now() - interval '1560 minutes');

-- Catalogue (art and category follow the prototype kindOf) ---------------------------------------------

insert into public.products (id, supplier_org_id, sku, name, unit, price, category, art, pack_kg, reorder_level, aliases, status, added_by_org_id, created_at) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-0000000000c1', 'DG-1001', 'Jasmine rice 5kg', 'bag', 8.90, 'dry_goods', 'sack', 5, 20, '{jasmine rice,jasmine}', 'active', '00000000-0000-4000-8000-0000000000c1', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-0000000000c1', 'DG-1002', 'Basmati rice 5kg', 'bag', 14.50, 'dry_goods', 'sack', 5, 12, '{basmati rice,basmati}', 'active', '00000000-0000-4000-8000-0000000000c1', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-0000000000c1', 'DG-1010', 'Cooking oil 2L', 'bottle', 9.40, 'oils_sauces', 'bottle', null, 15, '{cooking oil,vegetable oil}', 'active', '00000000-0000-4000-8000-0000000000c1', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-0000000000c1', 'DG-1011', 'Sesame oil 630ml', 'bottle', 7.80, 'oils_sauces', 'bottle', null, 10, '{sesame oil}', 'active', '00000000-0000-4000-8000-0000000000c1', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-0000000000c1', 'DG-1020', 'Evaporated milk 390g', 'tin', 1.35, 'dry_goods', 'tin', null, 60, '{evaporated milk,evap milk}', 'active', '00000000-0000-4000-8000-0000000000c1', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-0000000000c1', 'DG-1030', 'Dried noodles 400g', 'packet', 2.10, 'dry_goods', 'packet', null, 40, '{noodles,dried noodles}', 'active', '00000000-0000-4000-8000-0000000000c1', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-0000000000c1', 'DG-1040', 'Tissue paper, 30 packs', 'carton', 18.00, 'supplies', 'box', null, 10, '{tissue paper,tissue}', 'active', '00000000-0000-4000-8000-0000000000c1', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-0000000000c1', 'DG-1050', 'Granulated sugar 2kg', 'bag', 4.20, 'dry_goods', 'sack', 2, 30, '{sugar}', 'active', '00000000-0000-4000-8000-0000000000c1', '2025-01-06 09:00+08'),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-0000000000c2', 'FL-2001', 'Fresh eggs, 300 pieces', 'carton', 52.00, 'fresh', 'egg', null, 8, '{eggs,egg}', 'active', '00000000-0000-4000-8000-0000000000c2', '2025-02-03 09:00+08'),
  ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-0000000000c2', 'FL-2010', 'Chilli paste 1kg', 'tub', 11.20, 'oils_sauces', 'tub', null, 12, '{chilli paste,sambal}', 'active', '00000000-0000-4000-8000-0000000000c2', '2025-02-03 09:00+08'),
  ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-0000000000c2', 'FL-2020', 'Firm tofu 300g', 'pack', 1.10, 'fresh', 'block', null, 50, '{tofu,firm tofu}', 'active', '00000000-0000-4000-8000-0000000000c2', '2025-02-03 09:00+08'),
  ('00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-0000000000c2', 'FL-2030', 'Spring onion 1kg', 'bag', 4.60, 'fresh', 'leaf', 1, 8, '{spring onion}', 'active', '00000000-0000-4000-8000-0000000000c2', '2025-02-03 09:00+08'),
  ('00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-0000000000c3', 'NEW-1013', 'Rice flour 1kg', 'pack', 3.20, 'dry_goods', 'sack', null, 0, '{rice flour}', 'unconfirmed', '00000000-0000-4000-8000-0000000000b2', now() - interval '1560 minutes');

insert into public.price_changes (id, product_id, old_price, new_price, changed_by, created_at) values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000103', 8.90, 9.40,
   '00000000-0000-4000-9000-0000000000c1', now() - interval '1400 minutes');

-- Current orders (prototype ORD-1038 to ORD-1043) ------------------------------------------------------
-- placed, accepted, out and delivered are minutes ago; null means the order has not reached that step.

create temporary table seed_current (
  number bigint, buyer char(2), supplier char(2), status text, placed int, accepted int, out_at int, delivered int, check_status text
);
insert into seed_current values
  (1043, 'b2', 'c3', 'pending', 1560, null, null, null, 'unchecked'),
  (1042, 'b1', 'c1', 'pending', 38, null, null, null, 'unchecked'),
  (1041, 'b2', 'c1', 'accepted', 190, 150, null, null, 'unchecked'),
  (1040, 'b2', 'c2', 'out_for_delivery', 300, 290, 280, null, 'unchecked'),
  (1039, 'b1', 'c2', 'out_for_delivery', 420, 400, 360, null, 'unchecked'),
  (1038, 'b1', 'c1', 'delivered', 1500, 1480, 1440, 1400, 'problem');

insert into public.orders (id, number, buyer_org_id, supplier_org_id, status, confirmed_delivery_date, delivered_at, check_status, placed_by, created_at, updated_at)
select
  ('00000000-0000-4000-8000-' || lpad(s.number::text, 12, '0'))::uuid,
  s.number,
  ('00000000-0000-4000-8000-0000000000' || s.buyer)::uuid,
  ('00000000-0000-4000-8000-0000000000' || s.supplier)::uuid,
  s.status,
  -- Accepted orders deliver tomorrow, orders on the road today, delivered ones on their delivery day (Asia/Singapore).
  case s.status
    when 'accepted' then (now() at time zone 'Asia/Singapore')::date + 1
    when 'out_for_delivery' then (now() at time zone 'Asia/Singapore')::date
    when 'delivered' then ((now() - make_interval(mins => s.delivered)) at time zone 'Asia/Singapore')::date
  end,
  now() - make_interval(mins => s.delivered),
  s.check_status,
  ('00000000-0000-4000-9000-0000000000' || s.buyer)::uuid,
  now() - make_interval(mins => s.placed),
  now() - make_interval(mins => coalesce(s.delivered, s.out_at, s.accepted, s.placed))
from seed_current s;

-- Lines take the product price at order time; the unconfirmed product is not held.
insert into public.order_lines (order_id, product_id, qty, asked_qty, unit_price, held)
select ('00000000-0000-4000-8000-' || lpad(l.number::text, 12, '0'))::uuid, p.id, l.qty, l.qty, p.price, p.status = 'active'
from (values
  (1043, 'NEW-1013', 5),
  (1042, 'DG-1001', 6), (1042, 'DG-1010', 4),
  (1041, 'DG-1020', 24), (1041, 'DG-1040', 2),
  (1040, 'FL-2001', 3), (1040, 'FL-2010', 2),
  (1039, 'FL-2020', 10),
  (1038, 'DG-1030', 20)
) l(number, sku, qty)
join public.products p on p.sku = l.sku;

insert into public.order_events (order_id, from_status, to_status, actor_user_id, created_at)
select o.id, e.from_status, e.to_status,
       case when e.to_status = 'pending' then o.placed_by else ('00000000-0000-4000-9000-0000000000' || s.supplier)::uuid end,
       now() - make_interval(mins => e.mins)
from seed_current s
join public.orders o on o.number = s.number
cross join lateral (values
  (null, 'pending', s.placed),
  ('pending', 'accepted', s.accepted),
  ('accepted', 'out_for_delivery', s.out_at),
  ('out_for_delivery', 'delivered', s.delivered)
) e(from_status, to_status, mins)
where e.mins is not null;

-- Earlier delivered orders for Mei's Noodle House ----------------------------------------------------
-- Four Monday-start weeks (5, 12, 19 and 26 Oct 2026, Asia/Singapore), ordered Tuesday to Saturday so
-- each also falls in the prototype's week labels (6, 13, 20 and 27 Oct). Weekly totals: S$812.40,
-- S$765.40, S$904.60 and S$838.20. Cooking oil was S$8.90 before the price change.

create temporary table seed_history (number bigint, supplier char(2), placed timestamptz, delivered timestamptz);
insert into seed_history values
  (1022, 'c1', '2026-10-06 08:40+08', '2026-10-07 09:30+08'),
  (1023, 'c2', '2026-10-07 07:50+08', '2026-10-08 08:10+08'),
  (1024, 'c1', '2026-10-09 09:10+08', '2026-10-10 10:00+08'),
  (1025, 'c2', '2026-10-10 07:40+08', '2026-10-10 12:30+08'),
  (1026, 'c1', '2026-10-13 08:40+08', '2026-10-14 09:30+08'),
  (1027, 'c2', '2026-10-14 07:50+08', '2026-10-15 08:10+08'),
  (1028, 'c1', '2026-10-16 09:10+08', '2026-10-17 10:00+08'),
  (1029, 'c2', '2026-10-17 07:40+08', '2026-10-17 12:30+08'),
  (1030, 'c1', '2026-10-20 08:40+08', '2026-10-21 09:30+08'),
  (1031, 'c2', '2026-10-21 07:50+08', '2026-10-22 08:10+08'),
  (1032, 'c1', '2026-10-23 09:10+08', '2026-10-24 10:00+08'),
  (1033, 'c2', '2026-10-24 07:40+08', '2026-10-24 12:30+08'),
  (1034, 'c1', '2026-10-27 08:40+08', '2026-10-28 09:30+08'),
  (1035, 'c2', '2026-10-28 07:50+08', '2026-10-29 08:10+08'),
  (1036, 'c1', '2026-10-30 09:10+08', '2026-10-31 10:00+08'),
  (1037, 'c2', '2026-10-31 07:40+08', '2026-10-31 12:30+08');

insert into public.orders (id, number, buyer_org_id, supplier_org_id, status, confirmed_delivery_date, delivered_at, check_status, placed_by, created_at, updated_at)
select
  ('00000000-0000-4000-8000-' || lpad(h.number::text, 12, '0'))::uuid,
  h.number,
  '00000000-0000-4000-8000-0000000000b1',
  ('00000000-0000-4000-8000-0000000000' || h.supplier)::uuid,
  'delivered',
  (h.delivered at time zone 'Asia/Singapore')::date,
  h.delivered,
  'all_here',
  '00000000-0000-4000-9000-0000000000b1',
  h.placed,
  h.delivered
from seed_history h;

insert into public.order_lines (order_id, product_id, qty, asked_qty, unit_price, held)
select ('00000000-0000-4000-8000-' || lpad(l.number::text, 12, '0'))::uuid, p.id, l.qty, l.qty,
       case when p.sku = 'DG-1010' then 8.90 else p.price end, true
from (values
  (1022, 'DG-1001', 8), (1022, 'DG-1010', 6), (1022, 'DG-1030', 60), (1022, 'DG-1040', 2),
  (1023, 'FL-2001', 3), (1023, 'FL-2020', 60), (1023, 'FL-2030', 8), (1023, 'FL-2010', 3),
  (1024, 'DG-1001', 6), (1024, 'DG-1030', 40),
  (1025, 'FL-2001', 1), (1025, 'FL-2020', 40),
  (1026, 'DG-1001', 8), (1026, 'DG-1010', 4), (1026, 'DG-1030', 60), (1026, 'DG-1040', 1),
  (1027, 'FL-2001', 3), (1027, 'FL-2020', 50), (1027, 'FL-2030', 6), (1027, 'FL-2010', 2),
  (1028, 'DG-1001', 6), (1028, 'DG-1030', 40),
  (1029, 'FL-2001', 1), (1029, 'FL-2020', 50), (1029, 'FL-2030', 2),
  (1030, 'DG-1001', 10), (1030, 'DG-1010', 6), (1030, 'DG-1030', 80), (1030, 'DG-1040', 2), (1030, 'DG-1011', 2),
  (1031, 'FL-2001', 3), (1031, 'FL-2020', 60), (1031, 'FL-2030', 8), (1031, 'FL-2010', 3),
  (1032, 'DG-1001', 6), (1032, 'DG-1030', 48),
  (1033, 'FL-2001', 1), (1033, 'FL-2020', 40),
  (1034, 'DG-1001', 8), (1034, 'DG-1010', 6), (1034, 'DG-1030', 70), (1034, 'DG-1040', 2),
  (1035, 'FL-2001', 3), (1035, 'FL-2020', 60), (1035, 'FL-2030', 6), (1035, 'FL-2010', 2),
  (1036, 'DG-1001', 6), (1036, 'DG-1030', 50), (1036, 'DG-1050', 1),
  (1037, 'FL-2001', 1), (1037, 'FL-2020', 40)
) l(number, sku, qty)
join public.products p on p.sku = l.sku;

insert into public.order_events (order_id, from_status, to_status, actor_user_id, created_at)
select o.id, e.from_status, e.to_status,
       case when e.to_status = 'pending' then o.placed_by else ('00000000-0000-4000-9000-0000000000' || h.supplier)::uuid end,
       e.at
from seed_history h
join public.orders o on o.number = h.number
cross join lateral (values
  (null, 'pending', h.placed),
  ('pending', 'accepted', h.placed + interval '30 minutes'),
  ('accepted', 'out_for_delivery', h.delivered - interval '2 hours'),
  ('out_for_delivery', 'delivered', h.delivered)
) e(from_status, to_status, at);

select setval('public.order_number_seq', 1043);

-- Stock history ----------------------------------------------------------------------------------------
-- Every order reserves its held lines when placed, and every delivered order takes them out of stock.
-- Opening stock is received on 1 Oct 2026 in the amount that leaves on hand at the prototype figures,
-- so the stock history sums equal inventory_levels by construction.

create temporary table seed_moves (
  product_id uuid, type text, on_hand_change int, reserved_change int, reason text, order_id uuid, source text, actor uuid, at timestamptz
);

insert into seed_moves
select ol.product_id, 'reserved', 0, ol.qty, null, o.id, 'ORD-' || o.number, o.placed_by, o.created_at
from public.orders o join public.order_lines ol on ol.order_id = o.id
where ol.held;

insert into seed_moves
select ol.product_id, 'delivered', -ol.qty, -ol.qty, null, o.id, 'ORD-' || o.number,
       ('00000000-0000-4000-9000-' || right(o.supplier_org_id::text, 12))::uuid, o.delivered_at
from public.orders o join public.order_lines ol on ol.order_id = o.id
where o.status = 'delivered' and ol.held;

insert into seed_moves values
  ('00000000-0000-4000-8000-000000000101', 'received', 30, 0, null, null, 'Priya Nair', '00000000-0000-4000-9000-0000000000c1', now() - interval '2600 minutes');

insert into seed_moves
select p.id, 'received', t.on_hand - coalesce((select sum(m.on_hand_change) from seed_moves m where m.product_id = p.id), 0), 0,
       'opening_stock', null, 'Opening stock',
       ('00000000-0000-4000-9000-' || right(p.supplier_org_id::text, 12))::uuid, '2026-10-01 08:00+08'
from (values
  ('DG-1001', 46), ('DG-1002', 18), ('DG-1010', 30), ('DG-1011', 9), ('DG-1020', 120), ('DG-1030', 64), ('DG-1040', 7),
  ('DG-1050', 52), ('FL-2001', 14), ('FL-2010', 11), ('FL-2020', 80), ('FL-2030', 3)
) t(sku, on_hand)
join public.products p on p.sku = t.sku;

insert into public.stock_movements (product_id, type, on_hand_change, reserved_change, on_hand_after, reserved_after, reason, order_id, source, actor_user_id, created_at)
select m.product_id, m.type, m.on_hand_change, m.reserved_change,
       sum(m.on_hand_change) over w, sum(m.reserved_change) over w,
       m.reason, m.order_id, m.source, m.actor, m.at
from seed_moves m
window w as (partition by m.product_id order by m.at, m.type rows unbounded preceding)
order by m.at, m.product_id;

insert into public.inventory_levels (product_id, on_hand, reserved, updated_at)
select p.id, coalesce(sum(sm.on_hand_change), 0), coalesce(sum(sm.reserved_change), 0), coalesce(max(sm.created_at), p.created_at)
from public.products p
left join public.stock_movements sm on sm.product_id = p.id
group by p.id;

-- After delivery ----------------------------------------------------------------------------------------

insert into public.issues (id, number, order_id, buyer_org_id, supplier_org_id, product_id, type, qty, amount, note, status, created_at)
values ('00000000-0000-4000-8000-000000000301', 301, '00000000-0000-4000-8000-000000001038',
        '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000106',
        'short', 2, 4.20, '2 packets missing', 'open', now() - interval '400 minutes');
select setval('public.issue_number_seq', 301);

-- Mei's usual items (prototype usuals: qty, use, have = in_shop, last = last_paid).
insert into public.usual_items (buyer_org_id, product_id, usual_qty, use_per_day, in_shop, last_paid)
select '00000000-0000-4000-8000-0000000000b1', p.id, u.qty, u.use_per_day, u.in_shop, u.last_paid
from (values
  ('FL-2001', 1, 0.4, 1, 52.00), ('DG-1001', 4, 0.8, 6, 8.90), ('DG-1010', 3, 0.5, 2, 8.90), ('DG-1030', 20, 5, 12, 2.10),
  ('FL-2010', 2, 0.3, 4, 11.20), ('FL-2020', 20, 8, 44, 1.10), ('FL-2030', 3, 1.2, 2, 4.60), ('DG-1040', 1, 0.1, 1, 18.00)
) u(sku, qty, use_per_day, in_shop, last_paid)
join public.products p on p.sku = u.sku;

-- Audit log and notifications ---------------------------------------------------------------------------
-- "Accepted ORD-1041" is 150 minutes ago: the prototype's 250 would come before the order was placed (190).

insert into public.audit_log (at, actor_user_id, actor_name, actor_org_id, actor_org_name, actor_role, action, related_org_ids, outcome)
select now() - make_interval(mins => a.mins),
       ('00000000-0000-4000-9000-0000000000' || a.who)::uuid, pr.full_name,
       o.id, o.name, o.kind, a.action,
       array(select ('00000000-0000-4000-8000-0000000000' || r)::uuid from unnest(a.related) r),
       a.outcome
from (values
  (38, 'b1', 'b1', 'Placed ORD-1042', '{c1,b1}'::text[], 'allowed'),
  (95, 'c1', 'c1', 'Blocked from opening ORD-1040, which belongs to another supplier', '{c1}'::text[], 'denied'),
  (190, 'b2', 'b2', 'Placed ORD-1041', '{c1,b2}'::text[], 'allowed'),
  (150, 'c1', 'c1', 'Accepted ORD-1041', '{c1,b2}'::text[], 'allowed'),
  (280, 'c2', 'c2', 'Marked ORD-1040 out for delivery', '{c2,b2}'::text[], 'allowed'),
  (1400, 'c1', 'c1', 'Marked ORD-1038 delivered', '{c1,b1}'::text[], 'allowed'),
  (1560, 'b2', 'b2', 'Added Rice flour 1kg and invited Bright Pantry Supplies', '{c3,b2}'::text[], 'allowed'),
  (2600, 'c1', 'c1', 'Received 30 of DG-1001', '{c1}'::text[], 'allowed')
) a(mins, who, org, action, related, outcome)
join public.profiles pr on pr.user_id = ('00000000-0000-4000-9000-0000000000' || a.who)::uuid
join public.organisations o on o.id = ('00000000-0000-4000-8000-0000000000' || a.org)::uuid
order by a.mins desc;

insert into public.notifications (recipient_org_id, kind, title, body, link, subject_org_id, created_at)
values ('00000000-0000-4000-8000-0000000000a0', 'Invitation sent', 'Bright Pantry Supplies invited',
        'Seaside Kopitiam added Bright Pantry Supplies. Invitation link sent to lina@brightpantry.example.',
        '/suppliers/00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c3',
        now() - interval '1560 minutes');

drop table seed_current, seed_history, seed_moves;
