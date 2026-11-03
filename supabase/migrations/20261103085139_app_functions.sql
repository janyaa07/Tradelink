-- Tradelink write path (ADR 0004, docs/RPC_CONTRACT.md).
-- Internal helpers live in schema app and are not executable by API roles. Public functions are
-- security definer, run with an empty search_path, and are executable by authenticated users only.
-- Errors are raised as 'TLnnn:REASON:detail'; the app maps code and reason to user copy.

-- Numbers for new product SKUs (NEW-1014, SP-1015, ...). The demo seed uses up to 1013.
create sequence app.product_number_seq start 1014;

-- Small pure helpers -------------------------------------------------------------------------

create function app.today_sg() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Singapore')::date
$$;

create function app.order_ref(p_number bigint) returns text
language sql immutable set search_path = '' as $$
  select 'ORD-' || p_number
$$;

create function app.money(p_amount numeric) returns text
language sql immutable set search_path = '' as $$
  select 'S$' || to_char(p_amount, 'FM999,999,990.00')
$$;

create function app.org_name(p_org uuid) returns text
language sql stable set search_path = '' as $$
  select o.name from public.organisations o where o.id = p_org
$$;

-- Picture and category guessed from a product name, in the same order as the prototype kindOf().
create function app.kind_of(p_name text, out art text, out category text)
language plpgsql immutable set search_path = '' as $$
declare
  n text := lower(coalesce(p_name, ''));
begin
  if n ~ 'egg' then art := 'egg'; category := 'fresh';
  elsif n ~ 'rice|sugar|flour' then art := 'sack'; category := 'dry_goods';
  elsif n ~ 'oil' then art := 'bottle'; category := 'oils_sauces';
  elsif n ~ 'milk' then art := 'tin'; category := 'dry_goods';
  elsif n ~ 'noodle' then art := 'packet'; category := 'dry_goods';
  elsif n ~ 'tissue' then art := 'box'; category := 'supplies';
  elsif n ~ 'chilli|sauce|paste' then art := 'tub'; category := 'oils_sauces';
  elsif n ~ 'tofu' then art := 'block'; category := 'fresh';
  elsif n ~ 'onion|veg|herb' then art := 'leaf'; category := 'fresh';
  elsif n ~ 'soap|clean' then art := 'soap'; category := 'supplies';
  else art := 'box'; category := 'supplies';
  end if;
end $$;

-- Input validation -----------------------------------------------------------------------------

create function app.json_uuid(p_value jsonb, p_field text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'string' then
    raise exception 'TL400:INVALID_INPUT:% must be an id', p_field;
  end if;
  return (p_value #>> '{}')::uuid;
exception when invalid_text_representation then
  raise exception 'TL400:INVALID_INPUT:% must be an id', p_field;
end $$;

create function app.json_int(p_value jsonb, p_field text, p_min int, p_max int) returns int
language plpgsql immutable set search_path = '' as $$
declare
  v numeric;
begin
  if jsonb_typeof(p_value) is distinct from 'number' then
    raise exception 'TL400:INVALID_INPUT:% must be a whole number from % to %', p_field, p_min, p_max;
  end if;
  v := (p_value #>> '{}')::numeric;
  if v <> trunc(v) or v < p_min or v > p_max then
    raise exception 'TL400:INVALID_INPUT:% must be a whole number from % to %', p_field, p_min, p_max;
  end if;
  return v::int;
end $$;

create function app.require_int(p_value int, p_field text, p_min int, p_max int) returns int
language plpgsql immutable set search_path = '' as $$
begin
  if p_value is null or p_value < p_min or p_value > p_max then
    raise exception 'TL400:INVALID_INPUT:% must be a whole number from % to %', p_field, p_min, p_max;
  end if;
  return p_value;
end $$;

create function app.require_price(p_price numeric) returns numeric
language plpgsql immutable set search_path = '' as $$
begin
  if p_price is null or p_price <= 0 or p_price > 99999 or p_price <> round(p_price, 2) then
    raise exception 'TL400:INVALID_INPUT:price must be above 0 and at most 99999, in cents';
  end if;
  return p_price;
end $$;

-- Trims and collapses spaces, then checks the length the products table allows.
create function app.require_product_name(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if length(v_name) not between 2 and 80 then
    raise exception 'TL400:INVALID_INPUT:product name must be 2 to 80 characters';
  end if;
  return v_name;
end $$;

-- Caller identity ------------------------------------------------------------------------------

-- The signed-in caller with their organisation. Raises TL401 when not signed in.
create function app.require_member(
  out user_id uuid, out user_name text, out org_id uuid, out org_kind text, out org_name text, out org_status text)
language plpgsql stable set search_path = '' as $$
begin
  user_id := auth.uid();
  if user_id is null then
    raise exception 'TL401:NOT_SIGNED_IN:sign in to continue';
  end if;
  select coalesce(p.full_name, 'Unknown user'), o.id, o.kind, o.name, o.status
    into user_name, org_id, org_kind, org_name, org_status
  from public.memberships m
  join public.organisations o on o.id = m.organisation_id
  left join public.profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid();
  if org_id is null then
    raise exception 'TL403:NOT_ALLOWED:no organisation for this account';
  end if;
end $$;

-- The caller, who must belong to an organisation of the given kind ('buyer', 'supplier' or
-- 'platform'). Suspended organisations can only view, so writes pass p_must_be_active = true.
create function app.require_kind(p_kind text, p_must_be_active boolean default true,
  out user_id uuid, out user_name text, out org_id uuid, out org_kind text, out org_name text, out org_status text)
language plpgsql stable set search_path = '' as $$
begin
  select m.user_id, m.user_name, m.org_id, m.org_kind, m.org_name, m.org_status
    into user_id, user_name, org_id, org_kind, org_name, org_status
  from app.require_member() m;
  if org_kind <> p_kind or (p_kind = 'platform' and not app.is_admin()) then
    raise exception 'TL403:NOT_ALLOWED:this needs a % account', p_kind;
  end if;
  if p_must_be_active and org_status <> 'active' then
    raise exception 'TL403:NOT_ALLOWED:organisation is %', org_status;
  end if;
end $$;

-- Idempotency ----------------------------------------------------------------------------------

-- Returns the stored result for (caller, action, key), or null when the key is new.
-- The advisory lock makes a concurrent retry with the same key wait and then see the stored result.
create function app.idem_get(p_action text, p_key uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_result jsonb;
begin
  if p_key is null then
    raise exception 'TL400:INVALID_INPUT:p_key is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_action || ':' || p_key::text, 0));
  select k.result into v_result
  from public.idempotency_keys k
  where k.user_id = auth.uid() and k.action = p_action and k.key = p_key;
  return v_result;
end $$;

create function app.idem_put(p_action text, p_key uuid, p_result jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  insert into public.idempotency_keys (user_id, action, key, result) values (auth.uid(), p_action, p_key, p_result);
  return p_result;
end $$;

-- Audit and notifications ------------------------------------------------------------------------

-- Appends an audit row for the caller. The caller's organisation is always among related_org_ids.
create function app.audit(p_action text, p_related uuid[] default '{}', p_metadata jsonb default '{}', p_outcome text default 'allowed')
returns void
language plpgsql set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_member();
  insert into public.audit_log (actor_user_id, actor_name, actor_org_id, actor_org_name, actor_role, action, related_org_ids, outcome, metadata)
  values (
    v_me.user_id, v_me.user_name, v_me.org_id, v_me.org_name,
    case v_me.org_kind when 'platform' then 'admin' else v_me.org_kind end,
    p_action,
    array(select distinct r from unnest(array[v_me.org_id] || coalesce(p_related, '{}')) r where r is not null),
    p_outcome,
    coalesce(p_metadata, '{}'));
end $$;

create function app.notify(p_recipient uuid, p_kind text, p_title text, p_body text, p_link text default null, p_subject uuid default null)
returns void
language sql set search_path = '' as $$
  insert into public.notifications (recipient_org_id, kind, title, body, link, subject_org_id)
  values (p_recipient, p_kind, p_title, p_body, p_link, p_subject);
$$;

create function app.notify_platform(p_kind text, p_title text, p_body text, p_link text default null, p_subject uuid default null)
returns void
language sql set search_path = '' as $$
  insert into public.notifications (recipient_org_id, kind, title, body, link, subject_org_id)
  select o.id, p_kind, p_title, p_body, p_link, p_subject
  from public.organisations o where o.kind = 'platform' and o.status = 'active';
$$;

-- Stock ledger -----------------------------------------------------------------------------------

-- Locks inventory rows in ascending product id order. Every function that changes stock locks
-- through here first, so two transactions never wait on each other's rows in opposite order.
create function app.lock_inventory(p_products uuid[]) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.inventory_levels i
  where i.product_id = any (p_products)
  order by i.product_id
  for update;
end $$;

-- Changes inventory_levels and appends the matching stock_movements row with the balances after
-- the change. The table checks (on_hand >= 0, reserved <= on_hand) stop any invalid result.
create function app.move_stock(p_product uuid, p_type text, p_on_hand_change int, p_reserved_change int,
  p_order uuid, p_reason text, p_source text)
returns void
language plpgsql set search_path = '' as $$
declare
  v_on_hand int;
  v_reserved int;
begin
  update public.inventory_levels
  set on_hand = on_hand + p_on_hand_change, reserved = reserved + p_reserved_change, updated_at = now()
  where product_id = p_product
  returning on_hand, reserved into v_on_hand, v_reserved;
  if not found then
    raise exception 'TL404:NOT_FOUND:no stock record for product %', p_product;
  end if;
  insert into public.stock_movements
    (product_id, type, on_hand_change, reserved_change, on_hand_after, reserved_after, reason, order_id, source, actor_user_id)
  values
    (p_product, p_type, p_on_hand_change, p_reserved_change, v_on_hand, v_reserved, p_reason, p_order, p_source, auth.uid());
end $$;

-- Orders and issues ------------------------------------------------------------------------------

create function app.assert_transition(p_entity text, p_from text, p_to text, p_label text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (
    select 1 from app.state_transitions t
    where t.entity = p_entity and t.from_status = p_from and t.to_status = p_to
  ) then
    raise exception 'TL409:INVALID_TRANSITION:% is % and cannot become %', p_label, replace(p_from, '_', ' '), replace(p_to, '_', ' ');
  end if;
end $$;

-- Locks an order. p_org is the caller's organisation, which must be the buyer or supplier on it;
-- null skips that check (admins). Orders of other organisations look the same as missing ones.
create function app.lock_order(p_order uuid, p_org uuid) returns public.orders
language plpgsql set search_path = '' as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders o where o.id = p_order for update;
  if not found or (p_org is not null and p_org not in (v_order.buyer_org_id, v_order.supplier_org_id)) then
    raise exception 'TL404:NOT_FOUND:order %', p_order;
  end if;
  return v_order;
end $$;

create function app.lock_issue(p_issue uuid, p_org uuid) returns public.issues
language plpgsql set search_path = '' as $$
declare
  v_issue public.issues;
begin
  select * into v_issue from public.issues i where i.id = p_issue for update;
  if not found or (p_org is not null and p_org not in (v_issue.buyer_org_id, v_issue.supplier_org_id)) then
    raise exception 'TL404:NOT_FOUND:issue %', p_issue;
  end if;
  return v_issue;
end $$;

-- Moves an order to a new status and records the event. The status trigger checks it again.
create function app.transition_order(p_order public.orders, p_to text) returns void
language plpgsql set search_path = '' as $$
begin
  perform app.assert_transition('order', p_order.status, p_to, app.order_ref(p_order.number));
  update public.orders set status = p_to, updated_at = now() where id = p_order.id;
  insert into public.order_events (order_id, from_status, to_status, actor_user_id)
  values (p_order.id, p_order.status, p_to, auth.uid());
end $$;

-- Releases the reservation of every held line of an order (reject, cancel, suspension).
create function app.release_held(p_order public.orders) returns void
language plpgsql set search_path = '' as $$
declare
  v_line record;
begin
  perform app.lock_inventory(array(
    select ol.product_id from public.order_lines ol where ol.order_id = p_order.id and ol.held));
  for v_line in
    select ol.product_id, ol.qty from public.order_lines ol
    where ol.order_id = p_order.id and ol.held
    order by ol.product_id
  loop
    perform app.move_stock(v_line.product_id, 'released', 0, -v_line.qty, p_order.id, null, app.order_ref(p_order.number));
  end loop;
end $$;

-- out_for_delivery to delivered: each held line leaves on hand and reserved.
create function app.deliver_order(p_order public.orders) returns void
language plpgsql set search_path = '' as $$
declare
  v_line record;
begin
  perform app.transition_order(p_order, 'delivered');
  update public.orders set delivered_at = now() where id = p_order.id;
  perform app.lock_inventory(array(
    select ol.product_id from public.order_lines ol where ol.order_id = p_order.id and ol.held));
  for v_line in
    select ol.product_id, ol.qty from public.order_lines ol
    where ol.order_id = p_order.id and ol.held
    order by ol.product_id
  loop
    perform app.move_stock(v_line.product_id, 'delivered', -v_line.qty, -v_line.qty, p_order.id, null, app.order_ref(p_order.number));
  end loop;
end $$;

-- pending to accepted. Lines that were not held at order time (unconfirmed products) must now be
-- active products with enough stock; they are reserved, held and repriced at the current price.
create function app.accept_core(p_order public.orders, p_date date) returns void
language plpgsql set search_path = '' as $$
declare
  v_ref text := app.order_ref(p_order.number);
  v_unconfirmed text;
  v_short jsonb;
  v_line record;
begin
  perform app.assert_transition('order', p_order.status, 'accepted', v_ref);
  if p_date is null or p_date < app.today_sg() then
    raise exception 'TL400:INVALID_INPUT:delivery date must be today or later';
  end if;

  select string_agg(p.name, ', ' order by p.name) into v_unconfirmed
  from public.order_lines ol join public.products p on p.id = ol.product_id
  where ol.order_id = p_order.id and not ol.held and p.status <> 'active';
  if v_unconfirmed is not null then
    raise exception 'TL409:CONFIRM_STOCK_FIRST:%', v_unconfirmed;
  end if;

  perform app.lock_inventory(array(select ol.product_id from public.order_lines ol where ol.order_id = p_order.id));
  select jsonb_agg(jsonb_build_object('productId', ol.product_id, 'available', greatest(i.on_hand - i.reserved, 0)) order by ol.product_id)
    into v_short
  from public.order_lines ol join public.inventory_levels i on i.product_id = ol.product_id
  where ol.order_id = p_order.id and not ol.held and ol.qty > i.on_hand - i.reserved;
  if v_short is not null then
    raise exception 'TL409:STOCK_SHORT:%', v_short;
  end if;

  for v_line in
    select ol.id, ol.product_id, ol.qty, p.price
    from public.order_lines ol join public.products p on p.id = ol.product_id
    where ol.order_id = p_order.id and not ol.held
    order by ol.product_id
  loop
    update public.order_lines set held = true, unit_price = v_line.price where id = v_line.id;
    perform app.move_stock(v_line.product_id, 'reserved', 0, v_line.qty, p_order.id, null, v_ref);
  end loop;

  update public.orders set confirmed_delivery_date = p_date where id = p_order.id;
  perform app.transition_order(p_order, 'accepted');
end $$;

-- pending to rejected by the supplier, with ledger, audit and buyer notification.
create function app.reject_core(p_order public.orders) returns void
language plpgsql set search_path = '' as $$
declare
  v_ref text := app.order_ref(p_order.number);
begin
  perform app.transition_order(p_order, 'rejected');
  perform app.release_held(p_order);
  perform app.audit('Rejected ' || v_ref, array[p_order.buyer_org_id], jsonb_build_object('orderId', p_order.id));
  perform app.notify(p_order.buyer_org_id, 'Order rejected', v_ref || ' rejected',
    app.org_name(p_order.supplier_org_id) || ' could not take ' || v_ref || '. Nothing will be delivered for it.',
    '/orders/' || p_order.id, p_order.supplier_org_id);
end $$;

-- Buyer functions ---------------------------------------------------------------------------------

create function public.save_draft(p_lines jsonb, p_version int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_current int;
  v_hidden text;
begin
  select * into v_me from app.require_kind('buyer');
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 60 then
    raise exception 'TL400:INVALID_INPUT:lines must be a list of at most 60 items';
  end if;
  if p_version is null then
    raise exception 'TL400:INVALID_INPUT:p_version is required';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) e where jsonb_typeof(e) <> 'object') then
    raise exception 'TL400:INVALID_INPUT:each line must be an object';
  end if;

  select string_agg(e->>'productId', ', ') into v_hidden
  from jsonb_array_elements(p_lines) e
  where jsonb_typeof(e->'productId') = 'string'
    and not app.can_see_product(app.json_uuid(e->'productId', 'productId'));
  if v_hidden is not null then
    raise exception 'TL404:NOT_FOUND:product %', v_hidden;
  end if;

  -- One draft per user: serialise saves so the version check cannot race on the first insert.
  perform pg_advisory_xact_lock(hashtextextended('draft:' || v_me.user_id::text, 0));
  select d.version into v_current from public.order_drafts d where d.user_id = v_me.user_id;
  v_current := coalesce(v_current, 0);
  if p_version <> v_current then
    raise exception 'TL409:STALE_DRAFT:current version is %', v_current;
  end if;

  insert into public.order_drafts (user_id, buyer_org_id, lines, version, updated_at)
  values (v_me.user_id, v_me.org_id, p_lines, v_current + 1, now())
  on conflict (user_id) do update
    set buyer_org_id = excluded.buyer_org_id, lines = excluded.lines, version = excluded.version, updated_at = excluded.updated_at;

  return jsonb_build_object('version', v_current + 1);
end $$;

create function public.place_orders(p_lines jsonb, p_draft_version int, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_merged jsonb;
  v_hidden text;
  v_short jsonb;
  v_draft_version int;
  v_supplier record;
  v_line record;
  v_order_id uuid;
  v_number bigint;
  v_ref text;
  v_total numeric;
  v_items int;
  v_unheld int;
  v_orders jsonb := '[]';
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('place_orders', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 60 then
    raise exception 'TL400:INVALID_INPUT:lines must be a list of 1 to 60 items';
  end if;

  -- One line per product: duplicates are merged and their source texts joined.
  select jsonb_agg(jsonb_build_object('product_id', x.product_id, 'qty', x.qty, 'source_text', x.source_text) order by x.product_id)
    into v_merged
  from (
    select app.json_uuid(e->'productId', 'productId') as product_id,
           sum(app.json_int(e->'qty', 'qty', 1, 9999)) as qty,
           string_agg(nullif(btrim(e->>'sourceText'), ''), '; ') as source_text
    from jsonb_array_elements(p_lines) e
    group by 1
  ) x;
  if exists (select 1 from jsonb_to_recordset(v_merged) m(product_id uuid, qty int) where m.qty > 9999) then
    raise exception 'TL400:INVALID_INPUT:qty must be a whole number from 1 to 9999';
  end if;

  -- Visibility covers the product status, an open supplier (active or invited) and a connection.
  select string_agg(m.product_id::text, ', ') into v_hidden
  from jsonb_to_recordset(v_merged) m(product_id uuid)
  where not app.can_see_product(m.product_id);
  if v_hidden is not null then
    raise exception 'TL404:NOT_FOUND:product %', v_hidden;
  end if;

  perform app.lock_inventory(array(select m.product_id from jsonb_to_recordset(v_merged) m(product_id uuid)));
  select jsonb_agg(jsonb_build_object('productId', m.product_id, 'available', greatest(i.on_hand - i.reserved, 0)) order by m.product_id)
    into v_short
  from jsonb_to_recordset(v_merged) m(product_id uuid, qty int)
  join public.products p on p.id = m.product_id
  join public.inventory_levels i on i.product_id = m.product_id
  where p.status = 'active' and m.qty > i.on_hand - i.reserved;
  if v_short is not null then
    raise exception 'TL409:STOCK_SHORT:%', v_short;
  end if;

  select d.version into v_draft_version from public.order_drafts d where d.user_id = v_me.user_id for update;
  if found and p_draft_version is not null and p_draft_version <> v_draft_version then
    raise exception 'TL409:STALE_DRAFT:current version is %', v_draft_version;
  end if;

  for v_supplier in
    select p.supplier_org_id, s.name
    from jsonb_to_recordset(v_merged) m(product_id uuid)
    join public.products p on p.id = m.product_id
    join public.organisations s on s.id = p.supplier_org_id
    group by p.supplier_org_id, s.name
    order by s.name
  loop
    insert into public.orders (buyer_org_id, supplier_org_id, placed_by)
    values (v_me.org_id, v_supplier.supplier_org_id, v_me.user_id)
    returning id, number into v_order_id, v_number;
    v_ref := app.order_ref(v_number);

    -- Unconfirmed products are ordered at their estimated price and not held until accepted.
    insert into public.order_lines (order_id, product_id, qty, asked_qty, unit_price, held, source_text)
    select v_order_id, p.id, m.qty, m.qty, p.price, p.status = 'active', m.source_text
    from jsonb_to_recordset(v_merged) m(product_id uuid, qty int, source_text text)
    join public.products p on p.id = m.product_id
    where p.supplier_org_id = v_supplier.supplier_org_id;

    for v_line in
      select ol.product_id, ol.qty from public.order_lines ol
      where ol.order_id = v_order_id and ol.held
      order by ol.product_id
    loop
      perform app.move_stock(v_line.product_id, 'reserved', 0, v_line.qty, v_order_id, null, v_ref);
    end loop;

    insert into public.order_events (order_id, from_status, to_status, actor_user_id)
    values (v_order_id, null, 'pending', v_me.user_id);

    select sum(ol.qty * ol.unit_price), count(*), count(*) filter (where not ol.held)
      into v_total, v_items, v_unheld
    from public.order_lines ol where ol.order_id = v_order_id;

    perform app.audit('Placed ' || v_ref, array[v_supplier.supplier_org_id], jsonb_build_object('orderId', v_order_id));
    perform app.notify(v_supplier.supplier_org_id, 'New order', v_ref || ' from ' || v_me.org_name,
      v_me.org_name || ' placed ' || v_ref || ': ' || v_items || case when v_items = 1 then ' item, ' else ' items, ' end
        || app.money(v_total) || '.'
        || case when v_unheld > 0 then ' Confirm price and stock for new products before you accept.' else '' end,
      '/orders/' || v_order_id, v_me.org_id);

    v_orders := v_orders || jsonb_build_object('id', v_order_id, 'number', v_number, 'supplierName', v_supplier.name);
  end loop;

  update public.usual_items u set last_paid = p.price
  from jsonb_to_recordset(v_merged) m(product_id uuid)
  join public.products p on p.id = m.product_id
  where u.buyer_org_id = v_me.org_id and u.product_id = m.product_id;

  update public.order_drafts set lines = '[]', version = version + 1, updated_at = now()
  where user_id = v_me.user_id;

  return app.idem_put('place_orders', p_key, jsonb_build_object('orders', v_orders));
end $$;

create function public.cancel_order(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('cancel_order', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  perform app.transition_order(v_order, 'cancelled');
  perform app.release_held(v_order);

  perform app.audit('Cancelled ' || v_ref, array[v_order.supplier_org_id], jsonb_build_object('orderId', v_order.id));
  perform app.notify(v_order.supplier_org_id, 'Order cancelled', v_ref || ' cancelled',
    v_me.org_name || ' cancelled ' || v_ref || '. Reserved stock has been released.',
    '/orders/' || v_order.id, v_me.org_id);

  return app.idem_put('cancel_order', p_key,
    jsonb_build_object('id', v_order.id, 'number', v_order.number, 'status', 'cancelled'));
end $$;

create function public.confirm_all_here(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('confirm_all_here', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  -- Checking the items is proof of delivery, so an order still out for delivery is delivered first.
  if v_order.status = 'out_for_delivery' then
    perform app.deliver_order(v_order);
    v_order := app.lock_order(p_order, v_me.org_id);
  end if;
  if v_order.status <> 'delivered' or v_order.check_status <> 'unchecked' then
    raise exception 'TL409:INVALID_TRANSITION:% is % and already %', v_ref, replace(v_order.status, '_', ' '), v_order.check_status;
  end if;

  update public.orders set check_status = 'all_here', updated_at = now() where id = v_order.id;
  update public.usual_items u set in_shop = u.in_shop + ol.qty
  from public.order_lines ol
  where ol.order_id = v_order.id and u.buyer_org_id = v_me.org_id and u.product_id = ol.product_id;

  perform app.audit('Confirmed all items arrived for ' || v_ref, array[v_order.supplier_org_id], jsonb_build_object('orderId', v_order.id));

  return app.idem_put('confirm_all_here', p_key,
    jsonb_build_object('id', v_order.id, 'number', v_order.number, 'status', 'delivered', 'checkStatus', 'all_here'));
end $$;

create function public.report_problem(p_order uuid, p_product uuid, p_type text, p_qty int, p_note text, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
  v_line record;
  v_issue_id uuid;
  v_issue_number bigint;
  v_amount numeric;
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('report_problem', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  if p_type is null or p_type not in ('short', 'damaged', 'wrong_item', 'expired') then
    raise exception 'TL400:INVALID_INPUT:type must be short, damaged, wrong_item or expired';
  end if;
  if length(p_note) > 500 then
    raise exception 'TL400:INVALID_INPUT:note must be at most 500 characters';
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  select ol.qty, ol.unit_price, p.name into v_line
  from public.order_lines ol join public.products p on p.id = ol.product_id
  where ol.order_id = v_order.id and ol.product_id = p_product;
  if not found then
    raise exception 'TL404:NOT_FOUND:product % is not on %', p_product, v_ref;
  end if;
  perform app.require_int(p_qty, 'qty', 1, v_line.qty);

  if v_order.status = 'out_for_delivery' then
    perform app.deliver_order(v_order);
    v_order := app.lock_order(p_order, v_me.org_id);
  end if;
  if v_order.status <> 'delivered' or v_order.check_status <> 'unchecked' then
    raise exception 'TL409:INVALID_TRANSITION:% is % and already %', v_ref, replace(v_order.status, '_', ' '), v_order.check_status;
  end if;

  update public.orders set check_status = 'problem', updated_at = now() where id = v_order.id;
  v_amount := p_qty * v_line.unit_price;
  insert into public.issues (order_id, buyer_org_id, supplier_org_id, product_id, type, qty, amount, note)
  values (v_order.id, v_order.buyer_org_id, v_order.supplier_org_id, p_product, p_type, p_qty, v_amount, nullif(btrim(p_note), ''))
  returning id, number into v_issue_id, v_issue_number;

  -- Everything that arrived goes into the shop counts, less the affected quantity.
  update public.usual_items u
  set in_shop = u.in_shop + case when ol.product_id = p_product then ol.qty - p_qty else ol.qty end
  from public.order_lines ol
  where ol.order_id = v_order.id and u.buyer_org_id = v_me.org_id and u.product_id = ol.product_id;

  perform app.audit('Reported ' || replace(p_type, '_', ' ') || ' on ' || v_ref, array[v_order.supplier_org_id],
    jsonb_build_object('orderId', v_order.id, 'issueId', v_issue_id));
  perform app.notify(v_order.supplier_org_id, 'Problem reported', 'ISS-' || v_issue_number || ' on ' || v_ref,
    v_me.org_name || ' reported ' || p_qty || ' ' || v_line.name || ' ' || replace(p_type, '_', ' ') || ' on ' || v_ref
      || ' (' || app.money(v_amount) || ').',
    '/issues/' || v_issue_id, v_me.org_id);

  return app.idem_put('report_problem', p_key,
    jsonb_build_object('issueId', v_issue_id, 'number', v_issue_number, 'amount', v_amount));
end $$;

create function public.report_not_here(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
  v_issue_id uuid;
  v_issue_number bigint;
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('report_not_here', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  if v_order.status <> 'out_for_delivery' then
    raise exception 'TL409:INVALID_TRANSITION:% is %', v_ref, replace(v_order.status, '_', ' ');
  end if;
  if exists (select 1 from public.issues i where i.order_id = v_order.id and i.type = 'late' and i.status = 'open') then
    raise exception 'TL409:ALREADY_REPORTED:%', v_ref;
  end if;

  insert into public.issues (order_id, buyer_org_id, supplier_org_id, type)
  values (v_order.id, v_order.buyer_org_id, v_order.supplier_org_id, 'late')
  returning id, number into v_issue_id, v_issue_number;

  perform app.audit('Reported ' || v_ref || ' as late', array[v_order.supplier_org_id],
    jsonb_build_object('orderId', v_order.id, 'issueId', v_issue_id));
  perform app.notify(v_order.supplier_org_id, 'Delivery late', v_ref || ' not here yet',
    v_me.org_name || ' says ' || v_ref || ' has not arrived. Let them know when it will.',
    '/issues/' || v_issue_id, v_me.org_id);

  return app.idem_put('report_not_here', p_key, jsonb_build_object('issueId', v_issue_id, 'number', v_issue_number));
end $$;

create function public.mark_issue_seen(p_issue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_kind('buyer', false);
  update public.issues set buyer_seen = true where id = p_issue and buyer_org_id = v_me.org_id;
  if not found then
    raise exception 'TL404:NOT_FOUND:issue %', p_issue;
  end if;
  return jsonb_build_object('id', p_issue, 'buyerSeen', true);
end $$;

create function public.mark_credit_received(p_issue uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_issue public.issues;
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('mark_credit_received', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_issue := app.lock_issue(p_issue, v_me.org_id);
  perform app.assert_transition('issue', v_issue.status, 'credit_received', 'ISS-' || v_issue.number);
  update public.issues set status = 'credit_received' where id = v_issue.id;

  perform app.audit('Recorded credit received on ' || (select app.order_ref(o.number) from public.orders o where o.id = v_issue.order_id),
    array[v_issue.supplier_org_id], jsonb_build_object('issueId', v_issue.id, 'amount', v_issue.amount));

  return app.idem_put('mark_credit_received', p_key, jsonb_build_object('id', v_issue.id, 'status', 'credit_received'));
end $$;

create function public.buyer_add_product(p_name text, p_unit text, p_price numeric, p_supplier uuid, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_name text;
  v_supplier public.organisations;
  v_kind record;
  v_product_id uuid;
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('buyer_add_product', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_name := app.require_product_name(p_name);
  if p_unit is null or p_unit not in ('bag', 'bottle', 'box', 'can', 'carton', 'pack', 'packet', 'tin', 'tray', 'tub') then
    raise exception 'TL400:INVALID_INPUT:unknown unit %', p_unit;
  end if;
  perform app.require_price(p_price);

  select * into v_supplier from public.organisations o where o.id = p_supplier and o.kind = 'supplier';
  if not found or not app.connected(v_me.org_id, p_supplier) then
    raise exception 'TL404:NOT_FOUND:supplier %', p_supplier;
  end if;
  if v_supplier.status not in ('active', 'invited') then
    raise exception 'TL403:NOT_ALLOWED:supplier is %', v_supplier.status;
  end if;
  if exists (select 1 from public.products p where p.supplier_org_id = p_supplier and lower(p.name) = lower(v_name)) then
    raise exception 'TL409:DUPLICATE:%', v_name;
  end if;

  select * into v_kind from app.kind_of(v_name);
  begin
    insert into public.products (supplier_org_id, sku, name, unit, price, category, art, reorder_level, aliases, status, added_by_org_id)
    values (p_supplier, 'NEW-' || nextval('app.product_number_seq'), v_name, p_unit, p_price, v_kind.category, v_kind.art,
            0, array[lower(v_name)], 'unconfirmed', v_me.org_id)
    returning id into v_product_id;
  exception when unique_violation then
    raise exception 'TL409:DUPLICATE:%', v_name;
  end;
  insert into public.inventory_levels (product_id) values (v_product_id);

  perform app.audit('Added ' || v_name || ' to the catalogue', array[p_supplier], jsonb_build_object('productId', v_product_id));
  perform app.notify(p_supplier, 'Product added', v_name || ' added by ' || v_me.org_name,
    v_me.org_name || ' added ' || v_name || ' at an estimated ' || app.money(p_price) || '. Confirm the price and stock before you accept orders for it.',
    '/inventory/' || v_product_id, v_me.org_id);

  return app.idem_put('buyer_add_product', p_key, jsonb_build_object('productId', v_product_id));
end $$;

create function public.set_usual_item(p_product uuid, p_usual_qty int, p_use_per_day numeric, p_in_shop numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_kind('buyer');
  if not app.can_see_product(p_product) then
    raise exception 'TL404:NOT_FOUND:product %', p_product;
  end if;
  perform app.require_int(p_usual_qty, 'usual qty', 1, 9999);
  if p_use_per_day is null or p_use_per_day < 0 or p_use_per_day > 9999 then
    raise exception 'TL400:INVALID_INPUT:use per day must be from 0 to 9999';
  end if;
  if p_in_shop is null or p_in_shop < 0 or p_in_shop > 999999 then
    raise exception 'TL400:INVALID_INPUT:in shop must be from 0 to 999999';
  end if;

  insert into public.usual_items (buyer_org_id, product_id, usual_qty, use_per_day, in_shop)
  values (v_me.org_id, p_product, p_usual_qty, p_use_per_day, p_in_shop)
  on conflict (buyer_org_id, product_id) do update
    set usual_qty = excluded.usual_qty, use_per_day = excluded.use_per_day, in_shop = excluded.in_shop;

  return jsonb_build_object('productId', p_product, 'usualQty', p_usual_qty, 'usePerDay', p_use_per_day, 'inShop', p_in_shop);
end $$;

create function public.remove_usual_item(p_product uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_kind('buyer');
  delete from public.usual_items where buyer_org_id = v_me.org_id and product_id = p_product;
  if not found then
    raise exception 'TL404:NOT_FOUND:usual item %', p_product;
  end if;
  return jsonb_build_object('productId', p_product, 'removed', true);
end $$;

create function public.skip_restock_today(p_products uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_hidden text;
begin
  select * into v_me from app.require_kind('buyer');
  if p_products is null or cardinality(p_products) not between 1 and 200 then
    raise exception 'TL400:INVALID_INPUT:give 1 to 200 products';
  end if;
  select string_agg(x::text, ', ') into v_hidden from unnest(p_products) x where x is null or not app.can_see_product(x);
  if v_hidden is not null then
    raise exception 'TL404:NOT_FOUND:product %', v_hidden;
  end if;

  insert into public.restock_skips (buyer_org_id, product_id, skip_date)
  select distinct v_me.org_id, x, app.today_sg() from unnest(p_products) x
  on conflict do nothing;

  return jsonb_build_object('skipDate', app.today_sg(), 'products', to_jsonb(p_products));
end $$;

create function public.ack_price_change(p_change uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_product uuid;
begin
  select * into v_me from app.require_kind('buyer');
  select pc.product_id into v_product from public.price_changes pc where pc.id = p_change;
  if v_product is null or not app.can_see_product(v_product) then
    raise exception 'TL404:NOT_FOUND:price change %', p_change;
  end if;
  insert into public.price_change_acks (price_change_id, buyer_org_id) values (p_change, v_me.org_id)
  on conflict do nothing;
  return jsonb_build_object('id', p_change, 'acked', true);
end $$;

create function public.resolve_partial(p_partial uuid, p_choice text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_status text;
begin
  select * into v_me from app.require_kind('buyer');
  if p_choice is null or p_choice not in ('added', 'skipped') then
    raise exception 'TL400:INVALID_INPUT:choice must be added or skipped';
  end if;
  select pf.status into v_status
  from public.partial_fulfilments pf join public.orders o on o.id = pf.order_id
  where pf.id = p_partial and o.buyer_org_id = v_me.org_id
  for update of pf;
  if not found then
    raise exception 'TL404:NOT_FOUND:part acceptance %', p_partial;
  end if;
  if v_status <> 'new' then
    raise exception 'TL409:INVALID_TRANSITION:part acceptance is already %', v_status;
  end if;
  update public.partial_fulfilments set status = p_choice where id = p_partial;
  return jsonb_build_object('id', p_partial, 'status', p_choice);
end $$;

create function public.update_buyer_settings(p_budget numeric, p_suggest boolean, p_price_alerts boolean, p_budget_warning boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_kind('buyer');
  if p_budget is null or p_budget <= 0 or p_budget > 9999999 then
    raise exception 'TL400:INVALID_INPUT:budget must be above 0 and at most 9999999';
  end if;
  if p_suggest is null or p_price_alerts is null or p_budget_warning is null then
    raise exception 'TL400:INVALID_INPUT:every setting needs a value';
  end if;

  insert into public.buyer_settings (organisation_id, weekly_budget, suggest_reorder, price_alerts, budget_warning)
  values (v_me.org_id, round(p_budget, 2), p_suggest, p_price_alerts, p_budget_warning)
  on conflict (organisation_id) do update
    set weekly_budget = excluded.weekly_budget, suggest_reorder = excluded.suggest_reorder,
        price_alerts = excluded.price_alerts, budget_warning = excluded.budget_warning;

  perform app.audit('Updated buyer settings');
  return jsonb_build_object('weeklyBudget', round(p_budget, 2), 'suggestReorder', p_suggest,
    'priceAlerts', p_price_alerts, 'budgetWarning', p_budget_warning);
end $$;

-- Supplier functions -------------------------------------------------------------------------------

create function public.accept_order(p_order uuid, p_date date, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('accept_order', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  perform app.accept_core(v_order, p_date);

  perform app.audit('Accepted ' || v_ref, array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
  perform app.notify(v_order.buyer_org_id, 'Order accepted', v_ref || ' accepted',
    v_me.org_name || ' accepted ' || v_ref || ' for delivery on ' || to_char(p_date, 'Dy FMDD Mon') || '.',
    '/orders/' || v_order.id, v_me.org_id);

  return app.idem_put('accept_order', p_key, jsonb_build_object('id', v_order.id, 'number', v_order.number,
    'status', 'accepted', 'confirmedDeliveryDate', p_date));
end $$;

create function public.part_accept_order(p_order uuid, p_lines jsonb, p_date date, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
  v_send jsonb;
  v_line record;
  v_changes text[] := '{}';
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('part_accept_order', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  perform app.assert_transition('order', v_order.status, 'accepted', v_ref);

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 60 then
    raise exception 'TL400:INVALID_INPUT:lines must be a list of at most 60 items';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', app.json_uuid(e->'productId', 'productId'),
           'send_qty', app.json_int(e->'sendQty', 'sendQty', 0, 9999))), '[]')
    into v_send
  from jsonb_array_elements(p_lines) e;
  if (select count(distinct m.product_id) <> count(*) from jsonb_to_recordset(v_send) m(product_id uuid)) then
    raise exception 'TL400:INVALID_INPUT:each product can appear once';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_send) m(product_id uuid)
    where not exists (select 1 from public.order_lines ol where ol.order_id = v_order.id and ol.product_id = m.product_id)
  ) then
    raise exception 'TL400:INVALID_INPUT:every product must be on %', v_ref;
  end if;
  select ol.qty, p.name into v_line
  from jsonb_to_recordset(v_send) m(product_id uuid, send_qty int)
  join public.order_lines ol on ol.order_id = v_order.id and ol.product_id = m.product_id
  join public.products p on p.id = ol.product_id
  where m.send_qty > ol.qty
  limit 1;
  if found then
    raise exception 'TL400:INVALID_INPUT:enter 0 to % for %', v_line.qty, v_line.name;
  end if;

  -- Lines left out keep their full quantity. Sending nothing at all is a rejection.
  if not exists (
    select 1 from public.order_lines ol
    left join jsonb_to_recordset(v_send) m(product_id uuid, send_qty int) on m.product_id = ol.product_id
    where ol.order_id = v_order.id and coalesce(m.send_qty, ol.qty) > 0
  ) then
    perform app.reject_core(v_order);
    return app.idem_put('part_accept_order', p_key,
      jsonb_build_object('id', v_order.id, 'number', v_order.number, 'status', 'rejected'));
  end if;

  if p_date is null or p_date < app.today_sg() then
    raise exception 'TL400:INVALID_INPUT:delivery date must be today or later';
  end if;

  perform app.lock_inventory(array(select ol.product_id from public.order_lines ol where ol.order_id = v_order.id));
  for v_line in
    select ol.id, ol.product_id, ol.qty, ol.held, m.send_qty, p.name
    from public.order_lines ol
    join jsonb_to_recordset(v_send) m(product_id uuid, send_qty int) on m.product_id = ol.product_id
    join public.products p on p.id = ol.product_id
    where ol.order_id = v_order.id and m.send_qty < ol.qty
    order by ol.product_id
  loop
    if v_line.held then
      perform app.move_stock(v_line.product_id, 'released', 0, -(v_line.qty - v_line.send_qty), v_order.id, null, v_ref);
    end if;
    if v_line.send_qty = 0 then
      delete from public.order_lines where id = v_line.id;
    else
      update public.order_lines set qty = v_line.send_qty where id = v_line.id;
    end if;
    insert into public.partial_fulfilments (order_id, product_id, asked, sent)
    values (v_order.id, v_line.product_id, v_line.qty, v_line.send_qty);
    v_changes := v_changes || (v_line.send_qty || ' of ' || v_line.qty || ' ' || v_line.name);
  end loop;

  perform app.accept_core(v_order, p_date);

  if cardinality(v_changes) > 0 then
    perform app.audit('Part accepted ' || v_ref, array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
    perform app.notify(v_order.buyer_org_id, 'Order part accepted', v_ref || ' part accepted',
      v_me.org_name || ' accepted ' || v_ref || ' for ' || to_char(p_date, 'Dy FMDD Mon') || ' and can send '
        || array_to_string(v_changes, ', ') || '.',
      '/orders/' || v_order.id, v_me.org_id);
  else
    perform app.audit('Accepted ' || v_ref, array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
    perform app.notify(v_order.buyer_org_id, 'Order accepted', v_ref || ' accepted',
      v_me.org_name || ' accepted ' || v_ref || ' for delivery on ' || to_char(p_date, 'Dy FMDD Mon') || '.',
      '/orders/' || v_order.id, v_me.org_id);
  end if;

  return app.idem_put('part_accept_order', p_key, jsonb_build_object('id', v_order.id, 'number', v_order.number,
    'status', 'accepted', 'confirmedDeliveryDate', p_date, 'reducedLines', cardinality(v_changes)));
end $$;

create function public.reject_order(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('reject_order', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  perform app.reject_core(v_order);

  return app.idem_put('reject_order', p_key,
    jsonb_build_object('id', v_order.id, 'number', v_order.number, 'status', 'rejected'));
end $$;

-- Suspended suppliers may still complete orders they already accepted (USER_STORIES suspension rule).
create function public.mark_out_for_delivery(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
begin
  select * into v_me from app.require_kind('supplier', false);
  v_prev := app.idem_get('mark_out_for_delivery', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  perform app.transition_order(v_order, 'out_for_delivery');

  perform app.audit('Marked ' || v_ref || ' out for delivery', array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
  perform app.notify(v_order.buyer_org_id, 'Out for delivery', v_ref || ' is on the way',
    v_me.org_name || ' sent ' || v_ref || ' out for delivery.',
    '/orders/' || v_order.id, v_me.org_id);

  return app.idem_put('mark_out_for_delivery', p_key,
    jsonb_build_object('id', v_order.id, 'number', v_order.number, 'status', 'out_for_delivery'));
end $$;

create function public.mark_delivered(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
begin
  select * into v_me from app.require_kind('supplier', false);
  v_prev := app.idem_get('mark_delivered', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  perform app.deliver_order(v_order);

  perform app.audit('Marked ' || v_ref || ' delivered', array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
  perform app.notify(v_order.buyer_org_id, 'Order delivered', v_ref || ' delivered',
    v_me.org_name || ' delivered ' || v_ref || '. Check the items and tell us if anything is wrong.',
    '/orders/' || v_order.id, v_me.org_id);

  return app.idem_put('mark_delivered', p_key,
    jsonb_build_object('id', v_order.id, 'number', v_order.number, 'status', 'delivered'));
end $$;

create function public.answer_issue(p_issue uuid, p_answer text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_issue public.issues;
  v_ref text;
  v_iss text;
  v_to text;
  v_said text;
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('answer_issue', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_issue := app.lock_issue(p_issue, v_me.org_id);
  v_iss := 'ISS-' || v_issue.number;
  select app.order_ref(o.number) into v_ref from public.orders o where o.id = v_issue.order_id;
  if v_issue.status <> 'open' then
    raise exception 'TL409:INVALID_TRANSITION:% is %', v_iss, replace(v_issue.status, '_', ' ');
  end if;

  case p_answer
    when 'credit' then
      if v_issue.amount <= 0 then
        raise exception 'TL400:INVALID_INPUT:% has no amount to credit', v_iss;
      end if;
      v_to := 'credit_promised';
      v_said := 'Credit promised on ' || v_ref;
    when 'replace' then
      if v_issue.type in ('late', 'invoice') then
        raise exception 'TL400:INVALID_INPUT:a % problem cannot be replaced', v_issue.type;
      end if;
      v_to := 'replacement_promised';
      v_said := 'Replacement promised on ' || v_ref;
    when 'on_the_way' then
      if v_issue.type <> 'late' then
        raise exception 'TL400:INVALID_INPUT:on the way only answers a late delivery';
      end if;
      v_to := 'supplier_replied';
      v_said := 'Replied that ' || v_ref || ' is on the way';
    when 'dispute' then
      v_to := 'disputed';
      v_said := 'Disputed the ' || replace(v_issue.type, '_', ' ') || ' report on ' || v_ref;
    else
      raise exception 'TL400:INVALID_INPUT:answer must be credit, replace, on_the_way or dispute';
  end case;

  update public.issues set status = v_to, buyer_seen = false, answered_at = now() where id = v_issue.id;

  perform app.audit(v_said, array[v_issue.buyer_org_id], jsonb_build_object('issueId', v_issue.id, 'answer', p_answer));
  perform app.notify(v_issue.buyer_org_id, 'Problem answered', v_iss || ': ' || replace(v_to, '_', ' '),
    case p_answer
      when 'credit' then v_me.org_name || ' promised a credit of ' || app.money(v_issue.amount) || ' for ' || v_iss || ' on ' || v_ref || '.'
      when 'replace' then v_me.org_name || ' will replace the items in ' || v_iss || ' on ' || v_ref || '.'
      when 'on_the_way' then v_me.org_name || ' says ' || v_ref || ' is on the way.'
      else v_me.org_name || ' disputed ' || v_iss || ' on ' || v_ref || '. Tradelink will review it.'
    end,
    '/issues/' || v_issue.id, v_me.org_id);
  if p_answer = 'dispute' then
    perform app.notify_platform('Dispute opened', v_iss || ' disputed',
      v_me.org_name || ' disputed a ' || replace(v_issue.type, '_', ' ') || ' report on ' || v_ref
        || ' from ' || app.org_name(v_issue.buyer_org_id) || '.',
      '/issues/' || v_issue.id, v_me.org_id);
  end if;

  return app.idem_put('answer_issue', p_key, jsonb_build_object('id', v_issue.id, 'status', v_to));
end $$;

create function public.supplier_add_product(p_name text, p_unit text, p_price numeric, p_opening int, p_reorder int,
  p_category text, p_art text, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_name text;
  v_kind record;
  v_prefix text;
  v_sku text;
  v_product_id uuid;
  v_opening int := coalesce(p_opening, 0);
  v_reorder int := coalesce(p_reorder, 0);
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('supplier_add_product', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_name := app.require_product_name(p_name);
  if p_unit is null or p_unit not in ('bag', 'bottle', 'box', 'can', 'carton', 'pack', 'packet', 'tin', 'tray', 'tub') then
    raise exception 'TL400:INVALID_INPUT:unknown unit %', p_unit;
  end if;
  perform app.require_price(p_price);
  perform app.require_int(v_opening, 'opening stock', 0, 9999);
  perform app.require_int(v_reorder, 'reorder level', 0, 99999);
  select * into v_kind from app.kind_of(v_name);
  if p_category is not null and p_category not in ('fresh', 'dry_goods', 'oils_sauces', 'supplies') then
    raise exception 'TL400:INVALID_INPUT:unknown category %', p_category;
  end if;
  if p_art is not null and p_art not in ('egg', 'sack', 'bottle', 'tin', 'packet', 'box', 'tub', 'block', 'leaf', 'soap') then
    raise exception 'TL400:INVALID_INPUT:unknown picture %', p_art;
  end if;
  if exists (select 1 from public.products p where p.supplier_org_id = v_me.org_id and lower(p.name) = lower(v_name)) then
    raise exception 'TL409:DUPLICATE:%', v_name;
  end if;

  -- SKU prefix: initials of the first two words of the supplier's name, for example Fresh Lane Produce gives FL.
  select upper(string_agg(left(w.word, 1), '' order by w.n)) into v_prefix
  from (
    select s.word, s.n
    from regexp_split_to_table(regexp_replace(v_me.org_name, '[^A-Za-z ]', '', 'g'), '\s+') with ordinality s(word, n)
    where s.word <> ''
    order by s.n
    limit 2
  ) w;
  v_sku := coalesce(nullif(v_prefix, ''), 'SP') || '-' || nextval('app.product_number_seq');

  begin
    insert into public.products (supplier_org_id, sku, name, unit, price, category, art, reorder_level, aliases, status, added_by_org_id)
    values (v_me.org_id, v_sku, v_name, p_unit, p_price, coalesce(p_category, v_kind.category), coalesce(p_art, v_kind.art),
            v_reorder, array[lower(v_name)], 'active', v_me.org_id)
    returning id into v_product_id;
  exception when unique_violation then
    raise exception 'TL409:DUPLICATE:%', v_name;
  end;
  insert into public.inventory_levels (product_id) values (v_product_id);
  if v_opening > 0 then
    perform app.move_stock(v_product_id, 'received', v_opening, 0, null, 'opening_stock', 'Opening stock');
  end if;

  perform app.audit('Added product ' || v_name, '{}', jsonb_build_object('productId', v_product_id, 'sku', v_sku));
  return app.idem_put('supplier_add_product', p_key, jsonb_build_object('productId', v_product_id, 'sku', v_sku));
end $$;

create function public.receive_stock(p_product uuid, p_qty int, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_product public.products;
  v_on_hand int;
  v_reserved int;
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('receive_stock', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  perform app.require_int(p_qty, 'qty', 1, 9999);
  select * into v_product from public.products p where p.id = p_product and p.supplier_org_id = v_me.org_id for update;
  if not found then
    raise exception 'TL404:NOT_FOUND:product %', p_product;
  end if;
  perform app.lock_inventory(array[p_product]);

  -- Receiving stock for an unconfirmed product confirms it.
  if v_product.status = 'unconfirmed' then
    update public.products
    set status = 'active', reorder_level = case when reorder_level = 0 then 5 else reorder_level end
    where id = p_product;
  end if;
  perform app.move_stock(p_product, 'received', p_qty, 0, null, null, v_me.user_name);
  select i.on_hand, i.reserved into v_on_hand, v_reserved from public.inventory_levels i where i.product_id = p_product;

  perform app.audit('Received ' || p_qty || ' of ' || v_product.sku, '{}', jsonb_build_object('productId', p_product));
  return app.idem_put('receive_stock', p_key, jsonb_build_object('productId', p_product, 'onHand', v_on_hand, 'reserved', v_reserved,
    'status', case when v_product.status = 'unconfirmed' then 'active' else v_product.status end));
end $$;

create function public.confirm_product_stock(p_product uuid, p_qty int, p_price numeric, p_reorder int, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_product public.products;
  v_on_hand int;
  v_reserved int;
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('confirm_product_stock', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  perform app.require_int(p_qty, 'qty', 0, 9999);
  perform app.require_price(p_price);
  perform app.require_int(p_reorder, 'reorder level', 0, 99999);
  select * into v_product from public.products p where p.id = p_product and p.supplier_org_id = v_me.org_id for update;
  if not found then
    raise exception 'TL404:NOT_FOUND:product %', p_product;
  end if;
  if v_product.status <> 'unconfirmed' then
    raise exception 'TL409:INVALID_TRANSITION:% is already %', v_product.name, v_product.status;
  end if;
  perform app.lock_inventory(array[p_product]);

  update public.products set status = 'active', price = p_price, reorder_level = p_reorder where id = p_product;
  if p_qty > 0 then
    perform app.move_stock(p_product, 'received', p_qty, 0, null, null, v_me.user_name);
  end if;
  select i.on_hand, i.reserved into v_on_hand, v_reserved from public.inventory_levels i where i.product_id = p_product;

  perform app.audit('Confirmed ' || v_product.name || ' at ' || app.money(p_price) || ' with ' || p_qty || ' in stock',
    array[v_product.added_by_org_id], jsonb_build_object('productId', p_product));
  return app.idem_put('confirm_product_stock', p_key, jsonb_build_object('productId', p_product, 'status', 'active',
    'price', p_price, 'onHand', v_on_hand, 'reserved', v_reserved));
end $$;

create function public.change_price(p_product uuid, p_price numeric, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_product public.products;
  v_changed boolean;
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('change_price', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  perform app.require_price(p_price);
  select * into v_product from public.products p where p.id = p_product and p.supplier_org_id = v_me.org_id for update;
  if not found then
    raise exception 'TL404:NOT_FOUND:product %', p_product;
  end if;

  v_changed := p_price <> v_product.price;
  if v_changed then
    insert into public.price_changes (product_id, old_price, new_price, changed_by)
    values (p_product, v_product.price, p_price, v_me.user_id);
    update public.products set price = p_price where id = p_product;
    perform app.audit('Changed price of ' || v_product.sku || ' to ' || app.money(p_price), '{}',
      jsonb_build_object('productId', p_product, 'oldPrice', v_product.price, 'newPrice', p_price));
  end if;

  return app.idem_put('change_price', p_key, jsonb_build_object('productId', p_product, 'price', p_price, 'changed', v_changed));
end $$;

create function public.adjust_stock(p_product uuid, p_change int, p_reason text, p_note text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_product public.products;
  v_on_hand int;
  v_reserved int;
begin
  select * into v_me from app.require_kind('supplier');
  v_prev := app.idem_get('adjust_stock', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  perform app.require_int(p_change, 'change', -9999, 9999);
  if p_change = 0 then
    raise exception 'TL400:INVALID_INPUT:change cannot be 0';
  end if;
  if p_reason is null or p_reason not in ('damaged', 'expired', 'count_correction') then
    raise exception 'TL400:INVALID_INPUT:reason must be damaged, expired or count_correction';
  end if;
  if length(p_note) > 500 then
    raise exception 'TL400:INVALID_INPUT:note must be at most 500 characters';
  end if;
  select * into v_product from public.products p where p.id = p_product and p.supplier_org_id = v_me.org_id;
  if not found then
    raise exception 'TL404:NOT_FOUND:product %', p_product;
  end if;

  perform app.lock_inventory(array[p_product]);
  select i.on_hand, i.reserved into v_on_hand, v_reserved from public.inventory_levels i where i.product_id = p_product;
  if v_on_hand + p_change < v_reserved then
    raise exception 'TL409:BELOW_RESERVED:%', v_reserved;
  end if;
  perform app.move_stock(p_product, 'adjusted', p_change, 0, null, p_reason, v_me.user_name);

  perform app.audit('Adjusted ' || v_product.sku || ' by ' || case when p_change > 0 then '+' else '' end || p_change
      || ' (' || replace(p_reason, '_', ' ') || ')', '{}',
    jsonb_build_object('productId', p_product, 'note', nullif(btrim(p_note), '')));
  return app.idem_put('adjust_stock', p_key, jsonb_build_object('productId', p_product,
    'onHand', v_on_hand + p_change, 'reserved', v_reserved));
end $$;

create function public.update_business_profile(p_contact text, p_phone text, p_email text, p_address text, p_range text,
  p_days smallint[], p_lead int, p_cutoff time, p_minimum numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_days smallint[];
begin
  select * into v_me from app.require_kind('supplier');
  if length(btrim(coalesce(p_contact, ''))) not between 2 and 120 then
    raise exception 'TL400:INVALID_INPUT:contact name must be 2 to 120 characters';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ()-]{6,20}$' then
    raise exception 'TL400:INVALID_INPUT:phone number is not valid';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254 then
    raise exception 'TL400:INVALID_INPUT:email is not valid';
  end if;
  if length(p_address) > 200 or length(p_range) > 200 then
    raise exception 'TL400:INVALID_INPUT:address and range must be at most 200 characters';
  end if;
  -- Delivery days use ISO numbering: 1 is Monday, 7 is Sunday.
  if p_days is null or cardinality(p_days) = 0 or exists (select 1 from unnest(p_days) d where d is null or d not between 1 and 7) then
    raise exception 'TL400:INVALID_INPUT:delivery days must be 1 (Monday) to 7 (Sunday)';
  end if;
  perform app.require_int(p_lead, 'lead time', 0, 14);
  if p_cutoff is null then
    raise exception 'TL400:INVALID_INPUT:cut-off time is required';
  end if;
  if p_minimum is null or p_minimum < 0 or p_minimum > 99999 then
    raise exception 'TL400:INVALID_INPUT:minimum order must be from 0 to 99999';
  end if;
  v_days := array(select distinct d from unnest(p_days) d order by d);

  update public.organisations
  set contact_name = btrim(p_contact), phone = btrim(p_phone), email = lower(btrim(p_email)), address = nullif(btrim(p_address), '')
  where id = v_me.org_id;
  insert into public.supplier_profiles (organisation_id, product_range, delivery_days, lead_time_days, cutoff_time, minimum_order)
  values (v_me.org_id, nullif(btrim(p_range), ''), v_days, p_lead, p_cutoff, round(p_minimum, 2))
  on conflict (organisation_id) do update
    set product_range = excluded.product_range, delivery_days = excluded.delivery_days, lead_time_days = excluded.lead_time_days,
        cutoff_time = excluded.cutoff_time, minimum_order = excluded.minimum_order;

  perform app.audit('Updated business profile');
  return jsonb_build_object('orgId', v_me.org_id, 'updated', true);
end $$;

-- Admin functions ------------------------------------------------------------------------------------

create function public.set_supplier_status(p_org uuid, p_status text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_supplier public.organisations;
  v_order public.orders;
  v_buyer record;
  v_cancelled int := 0;
begin
  select * into v_me from app.require_kind('platform');
  v_prev := app.idem_get('set_supplier_status', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  select * into v_supplier from public.organisations o where o.id = p_org and o.kind = 'supplier' for update;
  if not found then
    raise exception 'TL404:NOT_FOUND:supplier %', p_org;
  end if;

  if v_supplier.status = 'active' and p_status = 'suspended' then
    -- Lock all stock touched by the supplier's pending orders once, in ascending order, then cancel them.
    perform app.lock_inventory(array(
      select ol.product_id from public.order_lines ol join public.orders o on o.id = ol.order_id
      where o.supplier_org_id = p_org and o.status = 'pending' and ol.held));
    for v_order in
      select * from public.orders o where o.supplier_org_id = p_org and o.status = 'pending' order by o.number for update
    loop
      perform app.transition_order(v_order, 'cancelled');
      perform app.release_held(v_order);
      perform app.notify(v_order.buyer_org_id, 'Order cancelled', app.order_ref(v_order.number) || ' cancelled',
        v_supplier.name || ' has been suspended, so ' || app.order_ref(v_order.number) || ' was cancelled. Order these items from another supplier.',
        '/orders/' || v_order.id, p_org);
      v_cancelled := v_cancelled + 1;
    end loop;
    update public.organisations set status = 'suspended' where id = p_org;
    perform app.notify(p_org, 'Account suspended', v_supplier.name || ' suspended',
      'Your account is suspended. Contact Tradelink to restore it.', null, p_org);
    for v_buyer in
      select c.buyer_org_id from public.trading_connections c where c.supplier_org_id = p_org and c.status in ('invited', 'active')
    loop
      perform app.notify(v_buyer.buyer_org_id, 'Supplier suspended', v_supplier.name || ' suspended',
        v_supplier.name || ' cannot take new orders for now.', '/suppliers/' || p_org, p_org);
    end loop;
    perform app.audit('Suspended supplier ' || v_supplier.name, array[p_org], jsonb_build_object('cancelledOrders', v_cancelled));
  elsif v_supplier.status = 'suspended' and p_status = 'active' then
    update public.organisations set status = 'active' where id = p_org;
    perform app.notify(p_org, 'Account reactivated', v_supplier.name || ' reactivated',
      'Your account is active again. Buyers can order from you.', null, p_org);
    for v_buyer in
      select c.buyer_org_id from public.trading_connections c where c.supplier_org_id = p_org and c.status in ('invited', 'active')
    loop
      perform app.notify(v_buyer.buyer_org_id, 'Supplier reactivated', v_supplier.name || ' reactivated',
        v_supplier.name || ' is taking orders again.', '/suppliers/' || p_org, p_org);
    end loop;
    perform app.audit('Reactivated supplier ' || v_supplier.name, array[p_org]);
  else
    raise exception 'TL409:INVALID_TRANSITION:% is % and cannot become %', v_supplier.name, v_supplier.status, coalesce(p_status, 'null');
  end if;

  return app.idem_put('set_supplier_status', p_key,
    jsonb_build_object('orgId', p_org, 'status', p_status, 'cancelledOrders', v_cancelled));
end $$;

create function public.resolve_dispute(p_issue uuid, p_outcome text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_issue public.issues;
  v_ref text;
  v_to text;
  v_body text;
begin
  select * into v_me from app.require_kind('platform');
  v_prev := app.idem_get('resolve_dispute', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_issue := app.lock_issue(p_issue, null);
  select app.order_ref(o.number) into v_ref from public.orders o where o.id = v_issue.order_id;
  if v_issue.status <> 'disputed' then
    raise exception 'TL409:INVALID_TRANSITION:ISS-% is %', v_issue.number, replace(v_issue.status, '_', ' ');
  end if;
  v_to := case p_outcome when 'credit' then 'credit_promised' when 'close' then 'closed' end;
  if v_to is null then
    raise exception 'TL400:INVALID_INPUT:outcome must be credit or close';
  end if;

  update public.issues set status = v_to, buyer_seen = false where id = v_issue.id;

  v_body := 'Tradelink reviewed the dispute on ' || v_ref || ': '
    || case when v_to = 'credit_promised' then 'the buyer gets a credit of ' || app.money(v_issue.amount) || '.' else 'closed with no credit.' end;
  perform app.notify(v_issue.buyer_org_id, 'Dispute resolved', 'ISS-' || v_issue.number || ' resolved', v_body,
    '/issues/' || v_issue.id, v_issue.supplier_org_id);
  perform app.notify(v_issue.supplier_org_id, 'Dispute resolved', 'ISS-' || v_issue.number || ' resolved', v_body,
    '/issues/' || v_issue.id, v_issue.buyer_org_id);
  perform app.audit('Resolved dispute on ' || v_ref || ': ' || case when v_to = 'credit_promised' then 'credit to buyer' else 'no credit' end,
    array[v_issue.supplier_org_id, v_issue.buyer_org_id], jsonb_build_object('issueId', v_issue.id));

  return app.idem_put('resolve_dispute', p_key, jsonb_build_object('id', v_issue.id, 'status', v_to));
end $$;

create function public.assign_attention(p_item text, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_kind('platform');
  if p_item is null or length(p_item) not between 1 and 200 then
    raise exception 'TL400:INVALID_INPUT:item key must be 1 to 200 characters';
  end if;
  if p_user is not null and not exists (
    select 1 from public.memberships m join public.organisations o on o.id = m.organisation_id
    where m.user_id = p_user and o.kind = 'platform'
  ) then
    raise exception 'TL400:INVALID_INPUT:only Tradelink operators can be assigned';
  end if;

  insert into public.attention_states (item_key, assigned_user_id) values (p_item, p_user)
  on conflict (item_key) do update set assigned_user_id = excluded.assigned_user_id;

  return jsonb_build_object('itemKey', p_item, 'assignedUserId', p_user);
end $$;

create function public.mark_attention_handled(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_kind('platform');
  if p_item is null or length(p_item) not between 1 and 200 then
    raise exception 'TL400:INVALID_INPUT:item key must be 1 to 200 characters';
  end if;

  insert into public.attention_states (item_key, handled_at, handled_by) values (p_item, now(), v_me.user_id)
  on conflict (item_key) do update set handled_at = excluded.handled_at, handled_by = excluded.handled_by;

  perform app.audit('Marked attention item ' || p_item || ' handled');
  return jsonb_build_object('itemKey', p_item, 'handledAt', now());
end $$;

-- Functions for every role -------------------------------------------------------------------------

create function public.mark_notifications_read(p_ids uuid[] default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_count int;
begin
  select * into v_me from app.require_member();
  update public.notifications
  set read_at = now()
  where recipient_org_id = v_me.org_id and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return jsonb_build_object('updated', v_count);
end $$;

create function public.set_theme(p_theme text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_member();
  if p_theme is null or p_theme not in ('system', 'light', 'dark') then
    raise exception 'TL400:INVALID_INPUT:theme must be system, light or dark';
  end if;
  update public.profiles set theme = p_theme where user_id = v_me.user_id;
  return jsonb_build_object('theme', p_theme);
end $$;

create function public.touch_last_seen() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
begin
  select * into v_me from app.require_member();
  update public.profiles set last_seen_at = now() where user_id = v_me.user_id;
  return jsonb_build_object('lastSeenAt', now());
end $$;

create function public.log_denied(p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_action is null or length(btrim(p_action)) not between 1 and 300 then
    raise exception 'TL400:INVALID_INPUT:action must be 1 to 300 characters';
  end if;
  perform app.audit(btrim(p_action), '{}', '{}', 'denied');
  return jsonb_build_object('logged', true);
end $$;

create function public.record_ai_usage(p_feature text, p_model text, p_input int, p_output int, p_latency int,
  p_outcome text, p_lines_read int, p_lines_matched int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_id bigint;
begin
  select * into v_me from app.require_member();
  if p_feature is null or p_feature not in ('order_read', 'invoice_read', 'ask', 'negotiation_draft') then
    raise exception 'TL400:INVALID_INPUT:unknown feature %', p_feature;
  end if;
  if p_outcome is null or p_outcome not in ('ok', 'fallback', 'refusal', 'timeout', 'error', 'invalid_output') then
    raise exception 'TL400:INVALID_INPUT:unknown outcome %', p_outcome;
  end if;
  if p_model is null or length(p_model) not between 1 and 100 then
    raise exception 'TL400:INVALID_INPUT:model must be 1 to 100 characters';
  end if;
  if least(p_input, p_output, p_latency, p_lines_read, p_lines_matched) < 0 then
    raise exception 'TL400:INVALID_INPUT:counts cannot be negative';
  end if;

  insert into public.ai_usage (organisation_id, user_id, feature, model, input_tokens, output_tokens, latency_ms, outcome, lines_read, lines_matched)
  values (v_me.org_id, v_me.user_id, p_feature, p_model, coalesce(p_input, 0), coalesce(p_output, 0), coalesce(p_latency, 0),
          p_outcome, coalesce(p_lines_read, 0), coalesce(p_lines_matched, 0))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- Fixed window per caller and action. Returns true while the caller is within the limit.
create function public.hit_rate_limit(p_action text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
  v_window timestamptz;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'TL401:NOT_SIGNED_IN:sign in to continue';
  end if;
  if p_action is null or length(p_action) not between 1 and 100 then
    raise exception 'TL400:INVALID_INPUT:action must be 1 to 100 characters';
  end if;
  perform app.require_int(p_limit, 'limit', 1, 100000);
  perform app.require_int(p_window_seconds, 'window', 1, 86400);

  v_key := auth.uid()::text || ':' || p_action;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  delete from public.rate_limits where key = v_key and window_start < v_window;
  insert into public.rate_limits as r (key, window_start, count) values (v_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_limit;
end $$;

-- Admin attention read model (DISCOVERY 6.6) ----------------------------------------------------------
-- Rules that need invoices or service checks are not built yet. An item is hidden once an admin
-- marks it handled after its cause appeared; a newer cause with the same key shows it again.

create view public.v_attention with (security_invoker = true) as
with causes as (
  select 'invite:' || s.id as item_key, 'medium' as priority, 'Supplier invitation' as type,
         s.name || ' has not joined' as title,
         'Invited by ' || coalesce(b.name, 'a buyer') || ' more than 24 hours ago.' as detail,
         s.id as org_id, s.created_at
  from public.organisations s
  left join public.organisations b on b.id = s.invited_by_org_id
  where s.kind = 'supplier' and s.status = 'invited' and s.created_at < now() - interval '24 hours'

  union all
  select 'dispute:' || i.id, 'high', 'Dispute',
         'ISS-' || i.number || ' disputed',
         sup.name || ' disputed a ' || replace(i.type, '_', ' ') || ' report on ORD-' || o.number || ' from ' || buy.name || '.',
         i.supplier_org_id, coalesce(i.answered_at, i.created_at)
  from public.issues i
  join public.orders o on o.id = i.order_id
  join public.organisations sup on sup.id = i.supplier_org_id
  join public.organisations buy on buy.id = i.buyer_org_id
  where i.status = 'disputed'

  union all
  select 'issue:' || i.id, 'medium', 'Delivery problem',
         'ISS-' || i.number || ' open for more than 4 hours',
         buy.name || ' reported ' || replace(i.type, '_', ' ') || ' on ORD-' || o.number || '. ' || sup.name || ' has not answered.',
         i.supplier_org_id, i.created_at
  from public.issues i
  join public.orders o on o.id = i.order_id
  join public.organisations sup on sup.id = i.supplier_org_id
  join public.organisations buy on buy.id = i.buyer_org_id
  where i.status = 'open' and i.created_at < now() - interval '4 hours'

  union all
  select 'stock-out:' || p.id, 'high', 'Stock',
         p.name || ' is out of stock',
         s.name || ' has none available to order.',
         p.supplier_org_id, inv.updated_at
  from public.products p
  join public.inventory_levels inv on inv.product_id = p.id
  join public.organisations s on s.id = p.supplier_org_id
  where p.status = 'active' and s.status = 'active' and inv.on_hand - inv.reserved <= 0

  union all
  select 'order:' || o.id, 'medium', 'Order',
         'ORD-' || o.number || ' waiting for ' || s.name,
         b.name || ' placed it more than 30 minutes ago.',
         o.supplier_org_id, o.created_at
  from public.orders o
  join public.organisations s on s.id = o.supplier_org_id
  join public.organisations b on b.id = o.buyer_org_id
  where o.status = 'pending' and s.status = 'active' and o.created_at < now() - interval '30 minutes'

  union all
  select 'catalogue:' || p.id, 'medium', 'Catalogue',
         p.name || ' not confirmed',
         'Added by ' || b.name || '. ' || s.name || ' has not confirmed the price and stock.',
         p.supplier_org_id, p.created_at
  from public.products p
  join public.organisations s on s.id = p.supplier_org_id
  join public.organisations b on b.id = p.added_by_org_id
  where p.status = 'unconfirmed' and s.status = 'active' and b.kind = 'buyer'

  union all
  select 'stock-low:' || p.id, 'medium', 'Stock',
         p.name || ' is running low',
         s.name || ' has ' || (inv.on_hand - inv.reserved) || ' available, reorder level ' || p.reorder_level || '.',
         p.supplier_org_id, inv.updated_at
  from public.products p
  join public.inventory_levels inv on inv.product_id = p.id
  join public.organisations s on s.id = p.supplier_org_id
  where p.status = 'active' and s.status = 'active'
    and inv.on_hand - inv.reserved > 0 and inv.on_hand - inv.reserved <= p.reorder_level

  union all
  select 'audit:' || a.id, 'medium', 'Security',
         'Blocked action',
         coalesce(a.actor_name, 'Unknown user') || ' (' || coalesce(a.actor_org_name, 'no organisation') || '): ' || a.action,
         a.actor_org_id, a.at
  from public.audit_log a
  where a.outcome = 'denied'
)
select c.item_key, c.priority, c.type, c.title, c.detail, c.org_id, c.created_at, st.assigned_user_id
from causes c
left join public.attention_states st on st.item_key = c.item_key
where app.is_admin()
  and (st.handled_at is null or st.handled_at < c.created_at);

revoke all on public.v_attention from anon;
grant select on public.v_attention to authenticated;

-- Privileges ----------------------------------------------------------------------------------------

-- Internal helpers run inside the security definer functions as their owner; API roles cannot call them.
revoke execute on function
  app.today_sg(), app.order_ref(bigint), app.money(numeric), app.org_name(uuid), app.kind_of(text),
  app.json_uuid(jsonb, text), app.json_int(jsonb, text, int, int), app.require_int(int, text, int, int),
  app.require_price(numeric), app.require_product_name(text),
  app.require_member(), app.require_kind(text, boolean),
  app.idem_get(text, uuid), app.idem_put(text, uuid, jsonb),
  app.audit(text, uuid[], jsonb, text), app.notify(uuid, text, text, text, text, uuid), app.notify_platform(text, text, text, text, uuid),
  app.lock_inventory(uuid[]), app.move_stock(uuid, text, int, int, uuid, text, text),
  app.assert_transition(text, text, text, text), app.lock_order(uuid, uuid), app.lock_issue(uuid, uuid),
  app.transition_order(public.orders, text), app.release_held(public.orders), app.deliver_order(public.orders),
  app.accept_core(public.orders, date), app.reject_core(public.orders)
from public, anon, authenticated;
revoke usage on sequence app.product_number_seq from public;

-- Public functions: authenticated only.
revoke execute on function
  public.save_draft(jsonb, int),
  public.place_orders(jsonb, int, uuid),
  public.cancel_order(uuid, uuid),
  public.confirm_all_here(uuid, uuid),
  public.report_problem(uuid, uuid, text, int, text, uuid),
  public.report_not_here(uuid, uuid),
  public.mark_issue_seen(uuid),
  public.mark_credit_received(uuid, uuid),
  public.buyer_add_product(text, text, numeric, uuid, uuid),
  public.set_usual_item(uuid, int, numeric, numeric),
  public.remove_usual_item(uuid),
  public.skip_restock_today(uuid[]),
  public.ack_price_change(uuid),
  public.resolve_partial(uuid, text),
  public.update_buyer_settings(numeric, boolean, boolean, boolean),
  public.accept_order(uuid, date, uuid),
  public.part_accept_order(uuid, jsonb, date, uuid),
  public.reject_order(uuid, uuid),
  public.mark_out_for_delivery(uuid, uuid),
  public.mark_delivered(uuid, uuid),
  public.answer_issue(uuid, text, uuid),
  public.supplier_add_product(text, text, numeric, int, int, text, text, uuid),
  public.receive_stock(uuid, int, uuid),
  public.confirm_product_stock(uuid, int, numeric, int, uuid),
  public.change_price(uuid, numeric, uuid),
  public.adjust_stock(uuid, int, text, text, uuid),
  public.update_business_profile(text, text, text, text, text, smallint[], int, time, numeric),
  public.set_supplier_status(uuid, text, uuid),
  public.resolve_dispute(uuid, text, uuid),
  public.assign_attention(text, uuid),
  public.mark_attention_handled(text),
  public.mark_notifications_read(uuid[]),
  public.set_theme(text),
  public.touch_last_seen(),
  public.log_denied(text),
  public.record_ai_usage(text, text, int, int, int, text, int, int),
  public.hit_rate_limit(text, int, int)
from public, anon;

grant execute on function
  public.save_draft(jsonb, int),
  public.place_orders(jsonb, int, uuid),
  public.cancel_order(uuid, uuid),
  public.confirm_all_here(uuid, uuid),
  public.report_problem(uuid, uuid, text, int, text, uuid),
  public.report_not_here(uuid, uuid),
  public.mark_issue_seen(uuid),
  public.mark_credit_received(uuid, uuid),
  public.buyer_add_product(text, text, numeric, uuid, uuid),
  public.set_usual_item(uuid, int, numeric, numeric),
  public.remove_usual_item(uuid),
  public.skip_restock_today(uuid[]),
  public.ack_price_change(uuid),
  public.resolve_partial(uuid, text),
  public.update_buyer_settings(numeric, boolean, boolean, boolean),
  public.accept_order(uuid, date, uuid),
  public.part_accept_order(uuid, jsonb, date, uuid),
  public.reject_order(uuid, uuid),
  public.mark_out_for_delivery(uuid, uuid),
  public.mark_delivered(uuid, uuid),
  public.answer_issue(uuid, text, uuid),
  public.supplier_add_product(text, text, numeric, int, int, text, text, uuid),
  public.receive_stock(uuid, int, uuid),
  public.confirm_product_stock(uuid, int, numeric, int, uuid),
  public.change_price(uuid, numeric, uuid),
  public.adjust_stock(uuid, int, text, text, uuid),
  public.update_business_profile(text, text, text, text, text, smallint[], int, time, numeric),
  public.set_supplier_status(uuid, text, uuid),
  public.resolve_dispute(uuid, text, uuid),
  public.assign_attention(text, uuid),
  public.mark_attention_handled(text),
  public.mark_notifications_read(uuid[]),
  public.set_theme(text),
  public.touch_last_seen(),
  public.log_denied(text),
  public.record_ai_usage(text, text, int, int, int, text, int, int),
  public.hit_rate_limit(text, int, int)
to authenticated;
