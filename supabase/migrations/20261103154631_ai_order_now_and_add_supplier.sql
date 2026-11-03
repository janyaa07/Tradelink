-- Tradelink AI: order items now without emptying the cart, and let buyers add a supplier.

create or replace function public.place_orders(p_lines jsonb, p_draft_version int, p_key uuid) returns jsonb
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

  -- An order from the cart empties it. A direct order (no draft version) leaves the cart alone.
  if p_draft_version is not null then
    update public.order_drafts set lines = '[]', version = version + 1, updated_at = now()
    where user_id = v_me.user_id;
  end if;

  return app.idem_put('place_orders', p_key, jsonb_build_object('orders', v_orders));
end $$;

-- A buyer adds a supplier who is not on Tradelink yet. It is created as invited and connected to
-- the buyer, so the buyer can add products for it; the platform follows up on the invitation.
create function public.buyer_add_supplier(p_name text, p_contact text, p_phone text, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_contact text := nullif(btrim(coalesce(p_contact, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_existing uuid;
  v_supplier_id uuid;
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('buyer_add_supplier', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'TL400:INVALID_INPUT:supplier name must be 2 to 120 characters';
  end if;
  if v_contact is not null and length(v_contact) > 120 then
    raise exception 'TL400:INVALID_INPUT:contact name is too long';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ]{8,16}$' then
    raise exception 'TL400:INVALID_INPUT:phone must be 8 to 16 digits';
  end if;

  select o.id into v_existing from public.organisations o where o.kind = 'supplier' and lower(o.name) = lower(v_name);
  if found then
    raise exception 'TL409:DUPLICATE:%', case when app.connected(v_me.org_id, v_existing) then 'connected' else 'listed' end;
  end if;

  insert into public.organisations (kind, name, status, contact_name, phone, invited_by_org_id)
  values ('supplier', v_name, 'invited', v_contact, v_phone, v_me.org_id)
  returning id into v_supplier_id;
  insert into public.supplier_profiles (organisation_id) values (v_supplier_id);
  insert into public.trading_connections (buyer_org_id, supplier_org_id, status) values (v_me.org_id, v_supplier_id, 'invited');

  perform app.audit('Added supplier ' || v_name, array[v_supplier_id], jsonb_build_object('supplierId', v_supplier_id));

  return app.idem_put('buyer_add_supplier', p_key, jsonb_build_object('supplierId', v_supplier_id, 'name', v_name));
end $$;

revoke execute on function public.buyer_add_supplier(text, text, text, uuid) from public, anon;
grant execute on function public.buyer_add_supplier(text, text, text, uuid) to authenticated;
