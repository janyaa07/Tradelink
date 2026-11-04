-- One order, two deliveries; delivery date changes both sides agree to; messages about an order.
--
-- A supplier who can send only part of an order now can send the rest on a later day. The rest
-- stays on the same order: each line keeps qty (coming with the first delivery) and later_qty
-- (coming with the second). The rest is not reserved, because the stock is not there yet; the
-- supplier delivers it with deliver_rest once it is. Either side can cancel the rest.
--
-- A delivery date only changes when the other side agrees: propose_delivery_date opens a request,
-- answer_delivery_date accepts or declines it. send_order_message is a short note about an order.
-- Requests and messages share order_requests, read through the order's own RLS.

-- Two deliveries ---------------------------------------------------------------------------------

alter table public.order_lines add column later_qty integer not null default 0;
alter table public.order_lines drop constraint order_lines_qty_check;
alter table public.order_lines add constraint order_lines_qty_check
  check (qty >= 0 and qty <= 9999 and later_qty >= 0 and later_qty <= 9999 and qty + later_qty > 0);

alter table public.orders add column later_delivery_date date;
alter table public.orders add column later_status text
  check (later_status in ('waiting', 'out_for_delivery', 'delivered', 'cancelled'));
alter table public.orders add column later_delivered_at timestamptz;
alter table public.orders add constraint orders_later_check
  check ((later_status is null) = (later_delivery_date is null));

-- Requests and messages ----------------------------------------------------------------------------

create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  from_org_id uuid not null references public.organisations (id),
  kind text not null check (kind in ('date_change', 'message')),
  -- Which delivery a date change is for: the first (or only) one, or the rest.
  part text check (part in ('first', 'rest')),
  proposed_date date,
  body text check (body is null or char_length(body) between 1 and 500),
  status text not null check (status in ('open', 'accepted', 'declined', 'withdrawn', 'sent')),
  answer text check (answer is null or char_length(answer) <= 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check (
    (kind = 'date_change' and part is not null and proposed_date is not null and status <> 'sent')
    or (kind = 'message' and body is not null and status = 'sent')
  )
);
create index order_requests_order_idx on public.order_requests (order_id, created_at);
alter table public.order_requests enable row level security;
create policy order_requests_read on public.order_requests for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_requests.order_id));

-- Lines with nothing coming now are left out of stock moves -----------------------------------------

create or replace function app.release_held(p_order public.orders) returns void
language plpgsql set search_path = '' as $$
declare
  v_line record;
begin
  perform app.lock_inventory(array(
    select ol.product_id from public.order_lines ol where ol.order_id = p_order.id and ol.held and ol.qty > 0));
  for v_line in
    select ol.product_id, ol.qty from public.order_lines ol
    where ol.order_id = p_order.id and ol.held and ol.qty > 0
    order by ol.product_id
  loop
    perform app.move_stock(v_line.product_id, 'released', 0, -v_line.qty, p_order.id, null, app.order_ref(p_order.number));
  end loop;
end $$;

create or replace function app.deliver_order(p_order public.orders) returns void
language plpgsql set search_path = '' as $$
declare
  v_line record;
begin
  perform app.transition_order(p_order, 'delivered');
  update public.orders set delivered_at = now() where id = p_order.id;
  perform app.lock_inventory(array(
    select ol.product_id from public.order_lines ol where ol.order_id = p_order.id and ol.held and ol.qty > 0));
  for v_line in
    select ol.product_id, ol.qty from public.order_lines ol
    where ol.order_id = p_order.id and ol.held and ol.qty > 0
    order by ol.product_id
  loop
    perform app.move_stock(v_line.product_id, 'delivered', -v_line.qty, -v_line.qty, p_order.id, null, app.order_ref(p_order.number));
  end loop;
end $$;

-- The other party on an order the caller's organisation is part of.
create function app.order_party(p_order public.orders, p_org uuid) returns uuid
language sql immutable set search_path = '' as $$
  select case when p_org = p_order.buyer_org_id then p_order.supplier_org_id else p_order.buyer_org_id end;
$$;

-- Part accept, now with an optional later delivery for the rest --------------------------------------

create function public.part_accept_order(p_order uuid, p_lines jsonb, p_date date, p_later_date date, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
  v_send jsonb;
  v_line record;
  v_dropped text[] := '{}';
  v_reduced text[] := '{}';
  v_later text[] := '{}';
  v_total numeric;
  v_body text;
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

  if p_date is null or p_date < app.today_sg() then
    raise exception 'TL400:INVALID_INPUT:delivery date must be today or later';
  end if;
  if p_later_date is not null and p_later_date <= p_date then
    raise exception 'TL400:INVALID_INPUT:the rest must come after the first delivery';
  end if;

  -- Lines left out keep their full quantity. Sending nothing now and nothing later is a rejection;
  -- with a later date, at least something has to go now.
  if not exists (
    select 1 from public.order_lines ol
    left join jsonb_to_recordset(v_send) m(product_id uuid, send_qty int) on m.product_id = ol.product_id
    where ol.order_id = v_order.id and coalesce(m.send_qty, ol.qty) > 0
  ) then
    if p_later_date is not null then
      raise exception 'TL400:INVALID_INPUT:nothing goes now, so accept % for % instead', v_ref, to_char(p_later_date, 'Dy FMDD Mon');
    end if;
    perform app.reject_core(v_order);
    return app.idem_put('part_accept_order', p_key,
      jsonb_build_object('id', v_order.id, 'number', v_order.number, 'status', 'rejected'));
  end if;

  perform app.lock_inventory(array(select ol.product_id from public.order_lines ol where ol.order_id = v_order.id));
  for v_line in
    select ol.id, ol.product_id, ol.qty, ol.held, m.send_qty, p.name
    from public.order_lines ol
    join jsonb_to_recordset(v_send) m(product_id uuid, send_qty int) on m.product_id = ol.product_id
    join public.products p on p.id = ol.product_id
    where ol.order_id = v_order.id and m.send_qty < ol.qty
    order by p.name
  loop
    if v_line.held then
      perform app.move_stock(v_line.product_id, 'released', 0, -(v_line.qty - v_line.send_qty), v_order.id, null, v_ref);
    end if;
    if p_later_date is not null then
      -- The rest stays on the order for the second delivery, not reserved until it goes.
      update public.order_lines set qty = v_line.send_qty, later_qty = v_line.qty - v_line.send_qty where id = v_line.id;
      v_later := v_later || (v_line.name || ' ' || (v_line.qty - v_line.send_qty));
    else
      if v_line.send_qty = 0 then
        delete from public.order_lines where id = v_line.id;
        v_dropped := v_dropped || (v_line.name || ' (you asked for ' || v_line.qty || ')');
      else
        update public.order_lines set qty = v_line.send_qty where id = v_line.id;
        v_reduced := v_reduced || (v_line.name || ' ' || v_line.send_qty || ' of ' || v_line.qty);
      end if;
      insert into public.partial_fulfilments (order_id, product_id, asked, sent)
      values (v_order.id, v_line.product_id, v_line.qty, v_line.send_qty);
    end if;
  end loop;

  perform app.accept_core(v_order, p_date);
  if p_later_date is not null and cardinality(v_later) > 0 then
    update public.orders set later_delivery_date = p_later_date, later_status = 'waiting', updated_at = now() where id = v_order.id;
  end if;

  select coalesce(sum(ol.qty * ol.unit_price), 0) into v_total from public.order_lines ol where ol.order_id = v_order.id;

  if cardinality(v_later) > 0 then
    v_body := v_me.org_name || ' accepted ' || v_ref || '. Part comes ' || to_char(p_date, 'Dy FMDD Mon')
      || ', the rest ' || to_char(p_later_date, 'Dy FMDD Mon') || ': ' || array_to_string(v_later, ', ') || '.';
    perform app.audit('Part accepted ' || v_ref || ', rest later', array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
    perform app.notify(v_order.buyer_org_id, 'Order part accepted', v_ref || ' comes in two deliveries', v_body, '/orders/' || v_order.id, v_me.org_id);
  elsif cardinality(v_dropped) + cardinality(v_reduced) > 0 then
    v_body := v_me.org_name || ' accepted ' || v_ref || ' for ' || to_char(p_date, 'Dy FMDD Mon') || '.'
      || case when cardinality(v_dropped) > 0 then ' Not coming: ' || array_to_string(v_dropped, ', ') || '.' else '' end
      || case when cardinality(v_reduced) > 0 then ' Less: ' || array_to_string(v_reduced, ', ') || '.' else '' end
      || ' New total ' || app.money(v_total) || '. Order the rest from the order page.';
    perform app.audit('Part accepted ' || v_ref, array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
    perform app.notify(v_order.buyer_org_id, 'Order part accepted', v_ref || ': not everything is coming', v_body, '/orders/' || v_order.id, v_me.org_id);
  else
    perform app.audit('Accepted ' || v_ref, array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
    perform app.notify(v_order.buyer_org_id, 'Order accepted', v_ref || ' accepted',
      v_me.org_name || ' accepted ' || v_ref || ' for delivery on ' || to_char(p_date, 'Dy FMDD Mon') || '.',
      '/orders/' || v_order.id, v_me.org_id);
  end if;

  return app.idem_put('part_accept_order', p_key, jsonb_build_object('id', v_order.id, 'number', v_order.number,
    'status', 'accepted', 'confirmedDeliveryDate', p_date, 'laterDeliveryDate', case when cardinality(v_later) > 0 then p_later_date end,
    'reducedLines', cardinality(v_dropped) + cardinality(v_reduced) + cardinality(v_later)));
end $$;

-- The four-argument version keeps working, with no later delivery.
create or replace function public.part_accept_order(p_order uuid, p_lines jsonb, p_date date, p_key uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select public.part_accept_order(p_order, p_lines, p_date, null::date, p_key);
$$;

-- The rest of an order -------------------------------------------------------------------------------

create function public.mark_rest_out_for_delivery(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
begin
  select * into v_me from app.require_kind('supplier', false);
  v_prev := app.idem_get('mark_rest_out_for_delivery', p_key);
  if v_prev is not null then
    return v_prev;
  end if;
  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  if v_order.later_status is distinct from 'waiting' then
    raise exception 'TL409:INVALID_TRANSITION:% has no rest waiting to go out', v_ref;
  end if;
  update public.orders set later_status = 'out_for_delivery', updated_at = now() where id = v_order.id;
  perform app.audit('Marked the rest of ' || v_ref || ' out for delivery', array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
  perform app.notify(v_order.buyer_org_id, 'Out for delivery', 'The rest of ' || v_ref || ' is on the way',
    v_me.org_name || ' sent the rest of ' || v_ref || ' out for delivery.', '/orders/' || v_order.id, v_me.org_id);
  return app.idem_put('mark_rest_out_for_delivery', p_key, jsonb_build_object('id', v_order.id, 'number', v_order.number, 'laterStatus', 'out_for_delivery'));
end $$;

-- Delivers the rest: it leaves stock now (it was never reserved), joins the delivered quantities,
-- and the buyer checks the order again.
create function public.deliver_rest(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
  v_line record;
begin
  select * into v_me from app.require_kind('supplier', false);
  v_prev := app.idem_get('deliver_rest', p_key);
  if v_prev is not null then
    return v_prev;
  end if;
  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  if v_order.later_status is null or v_order.later_status not in ('waiting', 'out_for_delivery') then
    raise exception 'TL409:INVALID_TRANSITION:% has no rest to deliver', v_ref;
  end if;
  if v_order.status not in ('accepted', 'out_for_delivery', 'delivered') then
    raise exception 'TL409:INVALID_TRANSITION:% is %', v_ref, replace(v_order.status, '_', ' ');
  end if;

  perform app.lock_inventory(array(select ol.product_id from public.order_lines ol where ol.order_id = v_order.id and ol.later_qty > 0));
  select p.name, i.on_hand - i.reserved as free, ol.later_qty into v_line
  from public.order_lines ol
  join public.inventory_levels i on i.product_id = ol.product_id
  join public.products p on p.id = ol.product_id
  where ol.order_id = v_order.id and ol.later_qty > 0 and ol.later_qty > i.on_hand - i.reserved
  limit 1;
  if found then
    raise exception 'TL409:REST_NOT_IN_STOCK:only % free for % (% needed)', greatest(v_line.free, 0), v_line.name, v_line.later_qty;
  end if;

  for v_line in
    select ol.id, ol.product_id, ol.later_qty from public.order_lines ol
    where ol.order_id = v_order.id and ol.later_qty > 0
    order by ol.product_id
  loop
    perform app.move_stock(v_line.product_id, 'delivered', -v_line.later_qty, 0, v_order.id, null, v_ref || ' rest');
    update public.order_lines set qty = qty + later_qty, later_qty = 0 where id = v_line.id;
  end loop;
  update public.orders
  set later_status = 'delivered', later_delivered_at = now(), check_status = 'unchecked', updated_at = now()
  where id = v_order.id;

  perform app.audit('Delivered the rest of ' || v_ref, array[v_order.buyer_org_id], jsonb_build_object('orderId', v_order.id));
  perform app.notify(v_order.buyer_org_id, 'Order delivered', 'The rest of ' || v_ref || ' delivered',
    v_me.org_name || ' delivered the rest of ' || v_ref || '. Check the items and tell us if anything is wrong.',
    '/orders/' || v_order.id, v_me.org_id);
  return app.idem_put('deliver_rest', p_key, jsonb_build_object('id', v_order.id, 'number', v_order.number, 'laterStatus', 'delivered'));
end $$;

-- Either side calls off the rest before it goes out. Lines with nothing left are removed.
create function public.cancel_rest(p_order uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
  v_other uuid;
begin
  select * into v_me from app.require_member();
  if v_me.org_status <> 'active' then
    raise exception 'TL403:NOT_ALLOWED:organisation is %', v_me.org_status;
  end if;
  v_prev := app.idem_get('cancel_rest', p_key);
  if v_prev is not null then
    return v_prev;
  end if;
  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  if v_order.later_status is distinct from 'waiting' then
    raise exception 'TL409:INVALID_TRANSITION:the rest of % can no longer be cancelled', v_ref;
  end if;
  delete from public.order_lines where order_id = v_order.id and qty = 0;
  update public.order_lines set later_qty = 0 where order_id = v_order.id and later_qty > 0;
  update public.orders set later_status = 'cancelled', updated_at = now() where id = v_order.id;
  update public.order_requests set status = 'withdrawn', answered_at = now()
  where order_id = v_order.id and kind = 'date_change' and part = 'rest' and status = 'open';

  v_other := app.order_party(v_order, v_me.org_id);
  perform app.audit('Cancelled the rest of ' || v_ref, array[v_other], jsonb_build_object('orderId', v_order.id));
  perform app.notify(v_other, 'Order changed', 'The rest of ' || v_ref || ' is cancelled',
    v_me.org_name || ' cancelled the rest of ' || v_ref || '. The first delivery is not affected.', '/orders/' || v_order.id, v_me.org_id);
  return app.idem_put('cancel_rest', p_key, jsonb_build_object('id', v_order.id, 'number', v_order.number, 'laterStatus', 'cancelled'));
end $$;

-- Delivery date changes ----------------------------------------------------------------------------

-- Either side asks to move a delivery. The other side accepts or declines; nothing moves until then.
-- A new request for the same delivery replaces an open one.
create function public.propose_delivery_date(p_order uuid, p_part text, p_date date, p_note text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
  v_other uuid;
  v_current date;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id uuid;
  v_what text;
begin
  select * into v_me from app.require_member();
  if v_me.org_status <> 'active' or v_me.org_kind not in ('buyer', 'supplier') then
    raise exception 'TL403:NOT_ALLOWED:this needs an active buyer or supplier account';
  end if;
  v_prev := app.idem_get('propose_delivery_date', p_key);
  if v_prev is not null then
    return v_prev;
  end if;
  if p_part is null or p_part not in ('first', 'rest') then
    raise exception 'TL400:INVALID_INPUT:part must be first or rest';
  end if;
  if p_date is null or p_date < app.today_sg() then
    raise exception 'TL400:INVALID_INPUT:the new date must be today or later';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'TL400:INVALID_INPUT:note must be at most 500 characters';
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  if p_part = 'first' then
    if v_order.status not in ('pending', 'accepted') then
      raise exception 'TL409:INVALID_TRANSITION:% is % and its date can no longer change', v_ref, replace(v_order.status, '_', ' ');
    end if;
    v_current := coalesce(v_order.confirmed_delivery_date, v_order.requested_delivery_date);
    v_what := v_ref;
  else
    if v_order.later_status is distinct from 'waiting' then
      raise exception 'TL409:INVALID_TRANSITION:% has no rest waiting', v_ref;
    end if;
    if p_date <= coalesce(v_order.confirmed_delivery_date, app.today_sg() - 1) then
      raise exception 'TL400:INVALID_INPUT:the rest must come after the first delivery';
    end if;
    v_current := v_order.later_delivery_date;
    v_what := 'the rest of ' || v_ref;
  end if;
  if p_date = v_current then
    raise exception 'TL400:INVALID_INPUT:% is already for %', v_what, to_char(p_date, 'Dy FMDD Mon');
  end if;

  update public.order_requests set status = 'withdrawn', answered_at = now()
  where order_id = v_order.id and kind = 'date_change' and part = p_part and status = 'open';
  insert into public.order_requests (order_id, from_org_id, kind, part, proposed_date, body, status, created_by)
  values (v_order.id, v_me.org_id, 'date_change', p_part, p_date, v_note, 'open', v_me.user_id)
  returning id into v_id;

  v_other := app.order_party(v_order, v_me.org_id);
  perform app.audit('Asked to move ' || v_what || ' to ' || to_char(p_date, 'Dy FMDD Mon'), array[v_other], jsonb_build_object('orderId', v_order.id, 'requestId', v_id));
  perform app.notify(v_other, 'Date change', v_me.org_name || ' asks to move ' || v_what,
    v_me.org_name || ' asks to move ' || v_what || coalesce(' from ' || to_char(v_current, 'Dy FMDD Mon'), '') || ' to '
      || to_char(p_date, 'Dy FMDD Mon') || '.' || coalesce(' "' || left(v_note, 120) || '"', '') || ' Accept or decline it on the order.',
    '/orders/' || v_order.id, v_me.org_id);
  return app.idem_put('propose_delivery_date', p_key, jsonb_build_object('id', v_id, 'orderId', v_order.id, 'number', v_order.number, 'part', p_part, 'date', p_date));
end $$;

create function public.answer_delivery_date(p_request uuid, p_accept boolean, p_note text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_request public.order_requests;
  v_order public.orders;
  v_ref text;
  v_what text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_me from app.require_member();
  if v_me.org_status <> 'active' then
    raise exception 'TL403:NOT_ALLOWED:organisation is %', v_me.org_status;
  end if;
  v_prev := app.idem_get('answer_delivery_date', p_key);
  if v_prev is not null then
    return v_prev;
  end if;
  if p_accept is null then
    raise exception 'TL400:INVALID_INPUT:accept must be true or false';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'TL400:INVALID_INPUT:note must be at most 500 characters';
  end if;

  select * into v_request from public.order_requests r where r.id = p_request and r.kind = 'date_change' for update;
  if not found then
    raise exception 'TL404:NOT_FOUND:request %', p_request;
  end if;
  v_order := app.lock_order(v_request.order_id, v_me.org_id);
  if v_request.from_org_id = v_me.org_id then
    raise exception 'TL403:NOT_ALLOWED:the other side answers this request';
  end if;
  v_ref := app.order_ref(v_order.number);
  v_what := case when v_request.part = 'rest' then 'the rest of ' || v_ref else v_ref end;
  if v_request.status <> 'open' then
    raise exception 'TL409:INVALID_TRANSITION:this request is already %', v_request.status;
  end if;

  if p_accept then
    if v_request.part = 'first' then
      if v_order.status not in ('pending', 'accepted') then
        raise exception 'TL409:INVALID_TRANSITION:% is % and its date can no longer change', v_ref, replace(v_order.status, '_', ' ');
      end if;
      if v_order.status = 'pending' then
        update public.orders set requested_delivery_date = v_request.proposed_date, updated_at = now() where id = v_order.id;
      else
        update public.orders set confirmed_delivery_date = v_request.proposed_date, updated_at = now() where id = v_order.id;
      end if;
    else
      if v_order.later_status is distinct from 'waiting' then
        raise exception 'TL409:INVALID_TRANSITION:% has no rest waiting', v_ref;
      end if;
      update public.orders set later_delivery_date = v_request.proposed_date, updated_at = now() where id = v_order.id;
    end if;
  end if;
  update public.order_requests set status = case when p_accept then 'accepted' else 'declined' end, answer = v_note, answered_at = now()
  where id = v_request.id;

  perform app.audit((case when p_accept then 'Agreed to move ' else 'Declined moving ' end) || v_what, array[v_request.from_org_id],
    jsonb_build_object('orderId', v_order.id, 'requestId', v_request.id));
  perform app.notify(v_request.from_org_id, 'Date change', v_me.org_name || (case when p_accept then ' agreed: ' else ' declined: ' end) || v_what,
    case when p_accept
      then v_me.org_name || ' agreed to move ' || v_what || ' to ' || to_char(v_request.proposed_date, 'Dy FMDD Mon') || '.'
      else v_me.org_name || ' declined moving ' || v_what || ' to ' || to_char(v_request.proposed_date, 'Dy FMDD Mon') || '. The date stays as it was.'
    end || coalesce(' "' || left(v_note, 120) || '"', ''),
    '/orders/' || v_order.id, v_me.org_id);
  return app.idem_put('answer_delivery_date', p_key, jsonb_build_object('id', v_request.id, 'orderId', v_order.id,
    'status', case when p_accept then 'accepted' else 'declined' end));
end $$;

-- Messages -------------------------------------------------------------------------------------------

-- A short note to the other side of an order, such as "please send as much as you can today".
create function public.send_order_message(p_order uuid, p_body text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_order public.orders;
  v_ref text;
  v_other uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  select * into v_me from app.require_member();
  if v_me.org_status <> 'active' or v_me.org_kind not in ('buyer', 'supplier') then
    raise exception 'TL403:NOT_ALLOWED:this needs an active buyer or supplier account';
  end if;
  v_prev := app.idem_get('send_order_message', p_key);
  if v_prev is not null then
    return v_prev;
  end if;
  if char_length(v_body) not between 1 and 500 then
    raise exception 'TL400:INVALID_INPUT:message must be 1 to 500 characters';
  end if;
  if not public.hit_rate_limit('send_order_message', 30, 3600) then
    raise exception 'TL429:RATE_LIMITED:too many messages, try again later';
  end if;

  v_order := app.lock_order(p_order, v_me.org_id);
  v_ref := app.order_ref(v_order.number);
  insert into public.order_requests (order_id, from_org_id, kind, body, status, created_by)
  values (v_order.id, v_me.org_id, 'message', v_body, 'sent', v_me.user_id)
  returning id into v_id;

  v_other := app.order_party(v_order, v_me.org_id);
  perform app.audit('Sent a message about ' || v_ref, array[v_other], jsonb_build_object('orderId', v_order.id, 'requestId', v_id));
  perform app.notify(v_other, 'Message', v_me.org_name || ' about ' || v_ref,
    case when char_length(v_body) > 170 then left(v_body, 167) || '...' else v_body end,
    '/orders/' || v_order.id, v_me.org_id);
  return app.idem_put('send_order_message', p_key, jsonb_build_object('id', v_id, 'orderId', v_order.id, 'number', v_order.number));
end $$;

-- Grants ---------------------------------------------------------------------------------------------

revoke execute on function app.order_party(public.orders, uuid) from public;
revoke execute on function
  public.part_accept_order(uuid, jsonb, date, date, uuid),
  public.mark_rest_out_for_delivery(uuid, uuid),
  public.deliver_rest(uuid, uuid),
  public.cancel_rest(uuid, uuid),
  public.propose_delivery_date(uuid, text, date, text, uuid),
  public.answer_delivery_date(uuid, boolean, text, uuid),
  public.send_order_message(uuid, text, uuid)
from public, anon;
grant execute on function
  public.part_accept_order(uuid, jsonb, date, date, uuid),
  public.mark_rest_out_for_delivery(uuid, uuid),
  public.deliver_rest(uuid, uuid),
  public.cancel_rest(uuid, uuid),
  public.propose_delivery_date(uuid, text, date, text, uuid),
  public.answer_delivery_date(uuid, boolean, text, uuid),
  public.send_order_message(uuid, text, uuid)
to authenticated;
