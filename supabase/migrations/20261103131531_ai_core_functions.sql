-- Tradelink AI core functions (M0): chat messages, cards, versioned shop orders, jobs, events, devices
-- and the agent log. Agent output (cards, agent messages, agent actions, jobs) is written only by the
-- server with the secret key (app.rs_is_system()), so a signed-in user can never forge it.

-- Helpers -----------------------------------------------------------------------------------------

-- The idempotency owner: the signed-in user, or a fixed id for server jobs.
create function app.rs_uid() returns uuid
language sql stable set search_path = '' as $$
  select coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
$$;

create function app.rs_idem_get(p_action text, p_key uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_result jsonb;
begin
  if p_key is null then
    raise exception 'TL400:INVALID_INPUT:p_key is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(app.rs_uid()::text || ':' || p_action || ':' || p_key::text, 0));
  select k.result into v_result from public.idempotency_keys k
  where k.user_id = app.rs_uid() and k.action = p_action and k.key = p_key;
  return v_result;
end $$;

create function app.rs_idem_put(p_action text, p_key uuid, p_result jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  insert into public.idempotency_keys (user_id, action, key, result) values (app.rs_uid(), p_action, p_key, p_result);
  return p_result;
end $$;

create function app.rs_require_system() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not app.rs_is_system() then
    raise exception 'TL403:FORBIDDEN:only the server can do this';
  end if;
end $$;

-- The caller's active role in the shop ('owner' or 'staff'), or 'system' for server jobs.
create function app.rs_require_shop(p_shop uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text;
begin
  if app.rs_is_system() then
    return 'system';
  end if;
  v_role := app.rs_shop_role(p_shop);
  if v_role is null then
    raise exception 'TL404:NOT_FOUND:shop %', p_shop;
  end if;
  return v_role;
end $$;

-- An optional whole number from JSON: null when absent, an error when present but invalid.
create function app.rs_opt_int(p_value jsonb, p_field text, p_min int, p_max int) returns int
language sql immutable set search_path = '' as $$
  select case when p_value is null or jsonb_typeof(p_value) = 'null' then null else app.json_int(p_value, p_field, p_min, p_max) end
$$;

create function app.rs_check_version(p_label text, p_current int, p_given int) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_given is null or p_given <> p_current then
    raise exception 'TL409:STALE_VERSION:% is now version %', p_label, p_current;
  end if;
end $$;

create function app.rs_event(p_name text, p_shop uuid, p_supplier uuid, p_subject_kind text, p_subject uuid, p_props jsonb default '{}')
returns void
language sql set search_path = '' as $$
  insert into public.event (name, shop_id, supplier_id, actor_user_id, subject_kind, subject_id, props)
  values (p_name, p_shop, p_supplier, auth.uid(), p_subject_kind, p_subject, coalesce(p_props, '{}'));
$$;

-- Schedules a job once per dedupe key. Rescheduling a pending job moves its time and payload.
create function app.rs_enqueue(p_kind text, p_run_at timestamptz, p_dedupe_key text, p_payload jsonb default '{}')
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.job (kind, run_at, dedupe_key, payload)
  values (p_kind, p_run_at, p_dedupe_key, coalesce(p_payload, '{}'))
  on conflict (dedupe_key) do update
    set run_at = excluded.run_at, payload = excluded.payload
    where public.job.status = 'PENDING'
  returning id into v_id;
  if v_id is null then
    select j.id into v_id from public.job j where j.dedupe_key = p_dedupe_key;
  end if;
  return v_id;
end $$;

-- Shop orders -------------------------------------------------------------------------------------

create function app.rs_lock_order(p_order uuid) returns public.shop_order
language plpgsql set search_path = '' as $$
declare
  v_order public.shop_order;
begin
  select * into v_order from public.shop_order o where o.id = p_order for update;
  if not found or not (app.rs_is_system() or app.rs_is_shop_member(v_order.shop_id)) then
    raise exception 'TL404:NOT_FOUND:order %', p_order;
  end if;
  return v_order;
end $$;

-- Lines as they stand, for snapshots and replies.
create function app.rs_order_lines(p_order uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'position', l.position, 'raw_text', l.raw_text, 'shop_item_id', l.shop_item_id,
    'qty', l.qty, 'hint_qty', l.hint_qty, 'status', l.status, 'pin_reason', l.pin_reason,
    'expected_price_cents', l.expected_price_cents, 'delivery_date', l.delivery_date, 'warnings', l.warnings
  ) order by l.position), '[]'::jsonb)
  from public.shop_order_line l where l.order_id = p_order
$$;

create function app.rs_snapshot_order(p_order public.shop_order) returns void
language sql set search_path = '' as $$
  insert into public.shop_order_version (order_id, version, state, lines, created_by)
  values (p_order.id, p_order.version, p_order.state, app.rs_order_lines(p_order.id), auth.uid())
  on conflict (order_id, version) do nothing;
$$;

-- The current, orderable item on the shop's list, or an error.
create function app.rs_require_item(p_shop uuid, p_item uuid) returns public.shop_item
language plpgsql stable set search_path = '' as $$
declare
  v_item public.shop_item;
begin
  select * into v_item from public.shop_item i
  where i.id = p_item and i.shop_id = p_shop and i.valid_to is null and i.status = 'ORDERABLE';
  if not found then
    raise exception 'TL404:NOT_FOUND:item % is not on this shop''s list', p_item;
  end if;
  return v_item;
end $$;

create function app.rs_expected_price(p_item public.shop_item) returns int
language sql stable set search_path = '' as $$
  select coalesce(e.last_paid_cents, e.low_cents)
  from public.expected_price e
  where e.shop_item_id = p_item.id and e.supplier_id = p_item.supplier_id
$$;

-- A line is ready when its item was picked or pinned and it has a quantity, or it was skipped.
create function app.rs_order_ready(p_order uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.shop_order_line l where l.order_id = p_order and l.status <> 'SKIPPED')
     and not exists (
       select 1 from public.shop_order_line l
       where l.order_id = p_order and l.status <> 'SKIPPED'
         and (l.shop_item_id is null or l.qty is null or (l.picked_by is null and l.pin_reason is null))
     )
$$;

create function app.rs_bump_order(p_order public.shop_order, p_state text) returns public.shop_order
language plpgsql set search_path = '' as $$
declare
  v_order public.shop_order;
begin
  update public.shop_order o
  set version = o.version + 1, state = p_state, updated_at = now()
  where o.id = p_order.id
  returning * into v_order;
  perform app.rs_snapshot_order(v_order);
  return v_order;
end $$;

-- Creates a draft order. Lines name an item only when the owner pinned it (exact name, nickname,
-- confirmed word, barcode or past order). Quantities are only what the owner said (EC02); a usual
-- quantity goes in hint_qty and is never used as the quantity.
create function public.rs_order_create(p_shop uuid, p_source text, p_lines jsonb, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := app.rs_require_shop(p_shop);
  v_done jsonb := app.rs_idem_get('rs_order_create', p_key);
  v_order public.shop_order;
  v_line jsonb;
  v_pos int := 0;
  v_item public.shop_item;
  v_pin text;
  v_list int;
begin
  if v_done is not null then
    return v_done;
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 60 then
    raise exception 'TL400:INVALID_INPUT:an order needs 1 to 60 lines';
  end if;
  select max(v.n) into v_list from public.list_version v where v.shop_id = p_shop and v.status = 'LOCKED';

  insert into public.shop_order (shop_id, source, created_by, list_version)
  values (p_shop, p_source, auth.uid(), v_list)
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pos := v_pos + 1;
    v_pin := v_line ->> 'pin_reason';
    v_item := null;
    if v_pin is not null and v_line ? 'shop_item_id' then
      v_item := app.rs_require_item(p_shop, (v_line ->> 'shop_item_id')::uuid);
    end if;
    insert into public.shop_order_line (order_id, position, raw_text, shop_item_id, qty, hint_qty, pin_reason, expected_price_cents, status)
    values (
      v_order.id, v_pos, left(coalesce(v_line ->> 'raw_text', ''), 240),
      v_item.id,
      app.rs_opt_int(v_line -> 'qty', 'qty', 1, 9999),
      app.rs_opt_int(v_line -> 'hint_qty', 'hint_qty', 0, 9999),
      case when v_item.id is null then null else v_pin end,
      case when v_item.id is null then null else app.rs_expected_price(v_item) end,
      case when v_item.id is not null and v_line ? 'qty' then 'PICKED' else 'OPEN' end);
  end loop;

  perform app.rs_snapshot_order(v_order);
  perform app.rs_event('order.created', p_shop, null, 'shop_order', v_order.id, jsonb_build_object('source', p_source, 'lines', v_pos));
  return app.rs_idem_put('rs_order_create', p_key, jsonb_build_object('order_id', v_order.id, 'version', v_order.version));
end $$;

-- The owner's pick for one line: the item he tapped and the quantity he set. Never from the agent.
create function public.rs_order_pick(p_order uuid, p_version int, p_line uuid, p_shop_item uuid, p_qty int, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_done jsonb := app.rs_idem_get('rs_order_pick', p_key);
  v_order public.shop_order;
  v_item public.shop_item;
begin
  if v_done is not null then
    return v_done;
  end if;
  if app.rs_is_system() or auth.uid() is null then
    raise exception 'TL403:FORBIDDEN:only the owner or staff can pick an item';
  end if;
  v_order := app.rs_lock_order(p_order);
  perform app.rs_require_shop(v_order.shop_id);
  perform app.rs_check_version('This order', v_order.version, p_version);
  if v_order.state not in ('DRAFT', 'AWAITING_CONFIRM') then
    raise exception 'TL409:INVALID_TRANSITION:order is % and cannot change', lower(v_order.state);
  end if;
  if p_shop_item is not null then
    v_item := app.rs_require_item(v_order.shop_id, p_shop_item);
  end if;
  perform app.require_int(p_qty, 'qty', 1, 9999);

  update public.shop_order_line l
  set shop_item_id = coalesce(v_item.id, l.shop_item_id),
      expected_price_cents = case when v_item.id is null then l.expected_price_cents else app.rs_expected_price(v_item) end,
      qty = p_qty,
      picked_by = case when v_item.id is null then l.picked_by else auth.uid() end,
      picked_at = case when v_item.id is null then l.picked_at else now() end,
      status = 'PICKED'
  where l.id = p_line and l.order_id = v_order.id;
  if not found then
    raise exception 'TL404:NOT_FOUND:line %', p_line;
  end if;

  v_order := app.rs_bump_order(v_order, case when v_order.state = 'AWAITING_CONFIRM' and app.rs_order_ready(v_order.id) then 'AWAITING_CONFIRM' else 'DRAFT' end);
  return app.rs_idem_put('rs_order_pick', p_key, jsonb_build_object('order_id', v_order.id, 'version', v_order.version, 'state', v_order.state));
end $$;

-- Edits from the owner: quantity, delivery date, skip, remove or a new line. Each call makes a new
-- version, so older cards and their buttons stop counting (EC08).
create function public.rs_order_revise(p_order uuid, p_version int, p_changes jsonb, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_done jsonb := app.rs_idem_get('rs_order_revise', p_key);
  v_order public.shop_order;
  v_change jsonb;
  v_line uuid;
  v_next int;
begin
  if v_done is not null then
    return v_done;
  end if;
  if app.rs_is_system() or auth.uid() is null then
    raise exception 'TL403:FORBIDDEN:only the owner or staff can change an order';
  end if;
  v_order := app.rs_lock_order(p_order);
  perform app.rs_require_shop(v_order.shop_id);
  perform app.rs_check_version('This order', v_order.version, p_version);
  if v_order.state not in ('DRAFT', 'AWAITING_CONFIRM') then
    raise exception 'TL409:INVALID_TRANSITION:order is % and cannot change', lower(v_order.state);
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) not between 1 and 60 then
    raise exception 'TL400:INVALID_INPUT:no changes given';
  end if;

  for v_change in select * from jsonb_array_elements(p_changes) loop
    v_line := case when v_change ->> 'op' = 'add' then null else app.json_uuid(v_change -> 'line_id', 'line_id') end;
    case v_change ->> 'op'
      when 'qty' then
        update public.shop_order_line l set qty = app.json_int(v_change -> 'qty', 'qty', 1, 9999)
        where l.id = v_line and l.order_id = v_order.id;
      when 'date' then
        update public.shop_order_line l set delivery_date = (v_change ->> 'date')::date
        where l.id = v_line and l.order_id = v_order.id;
      when 'skip' then
        update public.shop_order_line l set status = 'SKIPPED' where l.id = v_line and l.order_id = v_order.id;
      when 'remove' then
        delete from public.shop_order_line l where l.id = v_line and l.order_id = v_order.id;
      when 'add' then
        select coalesce(max(l.position), 0) + 1 into v_next from public.shop_order_line l where l.order_id = v_order.id;
        insert into public.shop_order_line (order_id, position, raw_text, qty)
        values (v_order.id, v_next, left(coalesce(v_change ->> 'raw_text', ''), 240), app.rs_opt_int(v_change -> 'qty', 'qty', 1, 9999));
      else
        raise exception 'TL400:INVALID_INPUT:unknown change %', v_change ->> 'op';
    end case;
    if v_change ->> 'op' <> 'add' and not found then
      raise exception 'TL404:NOT_FOUND:line %', v_line;
    end if;
  end loop;

  v_order := app.rs_bump_order(v_order, case when v_order.state = 'AWAITING_CONFIRM' and app.rs_order_ready(v_order.id) then 'AWAITING_CONFIRM' else 'DRAFT' end);
  return app.rs_idem_put('rs_order_revise', p_key, jsonb_build_object('order_id', v_order.id, 'version', v_order.version, 'state', v_order.state));
end $$;

-- Draft to awaiting confirm, once every line has an item the owner chose and a quantity.
create function public.rs_order_submit(p_order uuid, p_version int, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_done jsonb := app.rs_idem_get('rs_order_submit', p_key);
  v_order public.shop_order;
begin
  if v_done is not null then
    return v_done;
  end if;
  v_order := app.rs_lock_order(p_order);
  perform app.rs_require_shop(v_order.shop_id);
  perform app.rs_check_version('This order', v_order.version, p_version);
  if not app.rs_order_ready(v_order.id) then
    raise exception 'TL409:NOT_READY:every line needs an item you chose and a quantity';
  end if;
  update public.shop_order o set state = 'AWAITING_CONFIRM', updated_at = now() where o.id = v_order.id
  returning * into v_order;
  return app.rs_idem_put('rs_order_submit', p_key, jsonb_build_object('order_id', v_order.id, 'version', v_order.version, 'state', v_order.state));
end $$;

-- Confirm on the latest version: the only way a shop order becomes purchase orders, one per supplier,
-- each with the exact items locked. Only a person can confirm (US-06); level 3 auto-send comes later.
create function public.rs_order_confirm(p_order uuid, p_version int, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_done jsonb := app.rs_idem_get('rs_order_confirm', p_key);
  v_order public.shop_order;
  v_supplier uuid;
  v_po public.purchase_order;
  v_pos jsonb := '[]';
begin
  if v_done is not null then
    return v_done;
  end if;
  if app.rs_is_system() or auth.uid() is null then
    raise exception 'TL403:FORBIDDEN:only the owner or staff can confirm an order';
  end if;
  v_order := app.rs_lock_order(p_order);
  perform app.rs_require_shop(v_order.shop_id);
  perform app.rs_check_version('This order', v_order.version, p_version);
  if v_order.state <> 'AWAITING_CONFIRM' then
    raise exception 'TL409:INVALID_TRANSITION:order is % and cannot be confirmed', lower(v_order.state);
  end if;
  if not app.rs_order_ready(v_order.id) then
    raise exception 'TL409:NOT_READY:every line needs an item you chose and a quantity';
  end if;
  if exists (
    select 1 from public.shop_order_line l
    join public.shop_item i on i.id = l.shop_item_id
    where l.order_id = v_order.id and l.status <> 'SKIPPED' and (i.supplier_id is null or i.valid_to is not null or i.status <> 'ORDERABLE')
  ) then
    raise exception 'TL409:NOT_READY:an item on this order is no longer on your list';
  end if;

  for v_supplier in
    select distinct i.supplier_id from public.shop_order_line l
    join public.shop_item i on i.id = l.shop_item_id
    where l.order_id = v_order.id and l.status <> 'SKIPPED'
  loop
    insert into public.purchase_order (order_id, shop_id, supplier_id, urgent, delivery_date, channel)
    select v_order.id, v_order.shop_id, v_supplier, v_order.urgent,
           (select min(l.delivery_date) from public.shop_order_line l join public.shop_item i on i.id = l.shop_item_id
            where l.order_id = v_order.id and i.supplier_id = v_supplier and l.status <> 'SKIPPED'),
           coalesce((select ss.order_channel from public.shop_supplier ss where ss.shop_id = v_order.shop_id and ss.supplier_id = v_supplier), 'app')
    returning * into v_po;

    insert into public.po_line (po_id, version, position, shop_item_id, item_name, order_unit, qty, price_cents)
    select v_po.id, 1, row_number() over (order by l.position), l.shop_item_id,
           concat_ws(' ', p.brand, p.name, p.variant, p.pack_size), i.order_unit, l.qty, l.expected_price_cents
    from public.shop_order_line l
    join public.shop_item i on i.id = l.shop_item_id
    join public.product p on p.id = i.product_id
    where l.order_id = v_order.id and i.supplier_id = v_supplier and l.status <> 'SKIPPED';

    v_pos := v_pos || jsonb_build_object('id', v_po.id, 'number', v_po.number, 'supplier_id', v_supplier);
  end loop;

  update public.shop_order o
  set state = 'CONFIRMED', confirmed_by = auth.uid(), confirmed_at = now(), updated_at = now()
  where o.id = v_order.id
  returning * into v_order;
  perform app.rs_snapshot_order(v_order);

  insert into public.agent_action (shop_id, agent, action, subject_kind, subject_id, inputs, actor_user_id)
  values (v_order.shop_id, 'USER', 'order.confirm', 'shop_order', v_order.id, jsonb_build_object('version', v_order.version), auth.uid());
  perform app.rs_event('order.confirmed', v_order.shop_id, null, 'shop_order', v_order.id, jsonb_build_object('purchase_orders', jsonb_array_length(v_pos)));

  return app.rs_idem_put('rs_order_confirm', p_key,
    jsonb_build_object('order_id', v_order.id, 'version', v_order.version, 'state', v_order.state, 'purchase_orders', v_pos));
end $$;

create function public.rs_order_cancel(p_order uuid, p_version int, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_done jsonb := app.rs_idem_get('rs_order_cancel', p_key);
  v_order public.shop_order;
begin
  if v_done is not null then
    return v_done;
  end if;
  v_order := app.rs_lock_order(p_order);
  perform app.rs_require_shop(v_order.shop_id);
  perform app.rs_check_version('This order', v_order.version, p_version);
  update public.shop_order o set state = 'CANCELLED', updated_at = now() where o.id = v_order.id
  returning * into v_order;
  perform app.rs_snapshot_order(v_order);
  perform app.rs_event('order.cancelled', v_order.shop_id, null, 'shop_order', v_order.id);
  return app.rs_idem_put('rs_order_cancel', p_key, jsonb_build_object('order_id', v_order.id, 'version', v_order.version, 'state', v_order.state));
end $$;

-- Chat -------------------------------------------------------------------------------------------

-- A person's message. The client message id makes a resend after reconnecting a no-op (EC06).
create function public.rs_post_message(p_thread uuid, p_client_message_id text, p_body text, p_attachments jsonb default '[]', p_reply_to uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_thread public.chat_thread;
  v_kind text;
  v_msg public.chat_message;
begin
  if auth.uid() is null then
    raise exception 'TL401:UNAUTHENTICATED:sign in first';
  end if;
  select * into v_thread from public.chat_thread t where t.id = p_thread;
  if not found then
    raise exception 'TL404:NOT_FOUND:thread %', p_thread;
  end if;
  v_kind := case
    when v_thread.kind in ('shop', 'support') and app.rs_shop_role(v_thread.shop_id) is not null then app.rs_shop_role(v_thread.shop_id)
    when v_thread.kind = 'supplier' and app.rs_is_supplier_member(v_thread.supplier_id) then 'supplier'
    when app.rs_is_ops(v_thread.shop_id) then 'ops'
  end;
  if v_kind is null then
    raise exception 'TL404:NOT_FOUND:thread %', p_thread;
  end if;
  if length(coalesce(p_body, '')) > 4000 or (coalesce(trim(p_body), '') = '' and coalesce(jsonb_array_length(p_attachments), 0) = 0) then
    raise exception 'TL400:INVALID_INPUT:message is empty or too long';
  end if;

  insert into public.chat_message (thread_id, client_message_id, author_kind, author_user_id, body, attachments, reply_to)
  values (p_thread, p_client_message_id, v_kind, auth.uid(), coalesce(p_body, ''), coalesce(p_attachments, '[]'), p_reply_to)
  on conflict (thread_id, client_message_id) do nothing
  returning * into v_msg;

  if v_msg.id is null then
    select * into v_msg from public.chat_message m where m.thread_id = p_thread and m.client_message_id = p_client_message_id;
    return jsonb_build_object('id', v_msg.id, 'created_at', v_msg.created_at, 'duplicate', true);
  end if;
  return jsonb_build_object('id', v_msg.id, 'created_at', v_msg.created_at, 'duplicate', false);
end $$;

-- The agent's reply text, written by the server only.
create function public.rs_agent_message(p_thread uuid, p_body text, p_card uuid default null, p_reply_to uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform app.rs_require_system();
  insert into public.chat_message (thread_id, author_kind, body, card_id, reply_to)
  values (p_thread, 'agent', coalesce(p_body, ''), p_card, p_reply_to)
  returning id into v_id;
  return v_id;
end $$;

-- Shop thread for a shop, created on first use.
create function public.rs_shop_thread(p_shop uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform app.rs_require_shop(p_shop);
  select t.id into v_id from public.chat_thread t where t.kind = 'shop' and t.shop_id = p_shop;
  if v_id is null then
    insert into public.chat_thread (kind, shop_id) values ('shop', p_shop)
    on conflict do nothing returning id into v_id;
    if v_id is null then
      select t.id into v_id from public.chat_thread t where t.kind = 'shop' and t.shop_id = p_shop;
    end if;
  end if;
  return v_id;
end $$;

-- Cards (server only) -------------------------------------------------------------------------------

-- Stores a card the server has validated and hydrated from the database, and marks every older
-- card of the same type for the same subject as superseded ("Updated, see latest").
create function public.rs_put_card(p_card jsonb, p_post boolean default true)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_card public.card_instance;
begin
  perform app.rs_require_system();
  insert into public.card_instance (
    type, schema_version, audience, shop_id, supplier_id, subject_kind, subject_id, subject_version,
    state, data, actions, reason, question, surfaces, thread_id, created_by, expires_at)
  values (
    p_card ->> 'type', coalesce((p_card ->> 'schema_version')::int, 1), p_card ->> 'audience',
    (p_card ->> 'shop_id')::uuid, (p_card ->> 'supplier_id')::uuid,
    p_card ->> 'subject_kind', (p_card ->> 'subject_id')::uuid, coalesce((p_card ->> 'subject_version')::int, 1),
    p_card ->> 'state', p_card -> 'data', coalesce(p_card -> 'actions', '[]'), p_card -> 'reason', p_card -> 'question',
    coalesce((select array_agg(s) from jsonb_array_elements_text(p_card -> 'surfaces') s), '{chat}'),
    (p_card ->> 'thread_id')::uuid, coalesce(p_card ->> 'created_by', 'agent'), (p_card ->> 'expires_at')::timestamptz)
  returning * into v_card;

  update public.card_instance c
  set state = 'superseded', superseded_by = v_card.id, updated_at = now()
  where c.subject_kind = v_card.subject_kind and c.subject_id = v_card.subject_id and c.type = v_card.type
    and c.id <> v_card.id and c.superseded_by is null and c.state <> 'superseded'
    and c.subject_version <= v_card.subject_version;

  if p_post and v_card.thread_id is not null then
    insert into public.chat_message (thread_id, author_kind, card_id) values (v_card.thread_id, 'agent', v_card.id);
  end if;
  return v_card.id;
end $$;

-- A new state chip on the same card version (for example sent, then seen), or no buttons once done.
create function public.rs_set_card_state(p_card uuid, p_state text, p_actions jsonb default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  update public.card_instance c
  set state = p_state, actions = coalesce(p_actions, c.actions), updated_at = now()
  where c.id = p_card;
end $$;

-- Agent log, jobs, events, devices -------------------------------------------------------------------

create function public.rs_log_agent_action(p_action jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform app.rs_require_system();
  insert into public.agent_action (shop_id, supplier_id, agent, action, subject_kind, subject_id, inputs, rule, confidence, band, outcome, actor_user_id, undo_until)
  values (
    (p_action ->> 'shop_id')::uuid, (p_action ->> 'supplier_id')::uuid, p_action ->> 'agent', p_action ->> 'action',
    p_action ->> 'subject_kind', (p_action ->> 'subject_id')::uuid, coalesce(p_action -> 'inputs', '{}'),
    p_action ->> 'rule', (p_action ->> 'confidence')::numeric, p_action ->> 'band', coalesce(p_action ->> 'outcome', 'done'),
    (p_action ->> 'actor_user_id')::uuid, (p_action ->> 'undo_until')::timestamptz)
  returning id into v_id;
  return v_id;
end $$;

create function public.rs_job_enqueue(p_kind text, p_run_at timestamptz, p_dedupe_key text, p_payload jsonb default '{}')
returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  return app.rs_enqueue(p_kind, p_run_at, p_dedupe_key, p_payload);
end $$;

create function public.rs_job_cancel(p_dedupe_key text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  update public.job j set status = 'CANCELLED', done_at = now() where j.dedupe_key = p_dedupe_key and j.status = 'PENDING';
end $$;

-- Claims due jobs for one runner. Jobs left running for 10 minutes (a crashed runner) are claimed again.
create function public.rs_job_claim(p_limit int default 20)
returns setof public.job
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  return query
  update public.job j
  set status = 'RUNNING', attempts = j.attempts + 1, locked_at = now()
  where j.id in (
    select q.id from public.job q
    where (q.status = 'PENDING' and q.run_at <= now())
       or (q.status = 'RUNNING' and q.locked_at < now() - interval '10 minutes')
    order by q.run_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked)
  returning j.*;
end $$;

-- Finishes a job. A failure is retried with backoff up to 5 attempts, then stays FAILED for ops.
create function public.rs_job_finish(p_id uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  update public.job j
  set status = case when p_ok then 'DONE' when j.attempts >= 5 then 'FAILED' else 'PENDING' end,
      run_at = case when p_ok or j.attempts >= 5 then j.run_at else now() + make_interval(mins => power(2, j.attempts)::int) end,
      last_error = left(p_error, 1000),
      locked_at = null,
      done_at = case when p_ok or j.attempts >= 5 then now() end
  where j.id = p_id and j.status = 'RUNNING';
end $$;

-- An app event from a client (offline events keep their own time and are recorded once).
create function public.rs_log_event(p_name text, p_shop uuid, p_props jsonb default '{}', p_client_event_id text default null, p_occurred_at timestamptz default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_shop is not null then
    perform app.rs_require_shop(p_shop);
  elsif not app.rs_is_system() and auth.uid() is null then
    raise exception 'TL401:UNAUTHENTICATED:sign in first';
  end if;
  insert into public.event (name, shop_id, actor_user_id, props, client_event_id, occurred_at)
  values (p_name, p_shop, auth.uid(), coalesce(p_props, '{}'), p_client_event_id, least(coalesce(p_occurred_at, now()), now()))
  on conflict (client_event_id) do nothing;
end $$;

-- The signed-in person's app_user row, made on first use from their auth profile.
create function public.rs_ensure_app_user()
returns public.app_user
language plpgsql security definer set search_path = '' as $$
declare
  v_user public.app_user;
begin
  if auth.uid() is null then
    raise exception 'TL401:UNAUTHENTICATED:sign in first';
  end if;
  insert into public.app_user (id, full_name)
  select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '') from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;
  select * into v_user from public.app_user a where a.id = auth.uid();
  return v_user;
end $$;

-- Registers this device for web push, or turns push off when the subscription is null.
create function public.rs_device_register(p_platform text, p_subscription jsonb, p_app_version text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform public.rs_ensure_app_user();
  if p_subscription is not null and (p_subscription ->> 'endpoint') !~ '^https://' then
    raise exception 'TL400:INVALID_INPUT:push subscription endpoint must be https';
  end if;
  if p_subscription is not null then
    insert into public.device (user_id, platform, push_subscription, push_allowed, app_version)
    values (auth.uid(), p_platform, p_subscription, true, left(p_app_version, 40))
    on conflict ((push_subscription ->> 'endpoint')) where push_subscription is not null
    do update set user_id = excluded.user_id, push_allowed = true, app_version = excluded.app_version,
                  last_seen_at = now(), signed_out_at = null
    returning id into v_id;
  else
    insert into public.device (user_id, platform, push_allowed, app_version)
    values (auth.uid(), p_platform, false, left(p_app_version, 40))
    returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.rs_notification_opened(p_id uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.notification n set opened_at = coalesce(n.opened_at, now()) where n.id = p_id and n.user_id = auth.uid();
$$;

-- Permissions: nothing for anon; every function checks its own caller.
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'rs_order_create(uuid, text, jsonb, uuid)', 'rs_order_pick(uuid, int, uuid, uuid, int, uuid)',
    'rs_order_revise(uuid, int, jsonb, uuid)', 'rs_order_submit(uuid, int, uuid)', 'rs_order_confirm(uuid, int, uuid)',
    'rs_order_cancel(uuid, int, uuid)', 'rs_post_message(uuid, text, text, jsonb, uuid)', 'rs_agent_message(uuid, text, uuid, uuid)',
    'rs_shop_thread(uuid)', 'rs_put_card(jsonb, boolean)', 'rs_set_card_state(uuid, text, jsonb)',
    'rs_log_agent_action(jsonb)', 'rs_job_enqueue(text, timestamptz, text, jsonb)', 'rs_job_cancel(text)',
    'rs_job_claim(int)', 'rs_job_finish(uuid, boolean, text)', 'rs_log_event(text, uuid, jsonb, text, timestamptz)',
    'rs_ensure_app_user()', 'rs_device_register(text, jsonb, text)', 'rs_notification_opened(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', v_fn);
    execute format('grant execute on function public.%s to authenticated, service_role', v_fn);
  end loop;
end $$;

-- Default thresholds (docs/PLAN.md, section 10); ops can tune them.
insert into public.app_setting (key, value) values
  ('price.unusual_pct', '10'),
  ('price.unusual_min_cents', '200'),
  ('confidence.high', '0.85'),
  ('confidence.medium', '0.6'),
  ('notify.daily_unprompted_limit', '2'),
  ('order.merge_window_seconds', '60'),
  ('order.finish_reminder_minutes_before_cutoff', '60'),
  ('plan.minutes_before_cutoff', '120'),
  ('weighed.tolerance_pct', '10');

insert into public.app_release (platform, version, min_version) values ('web', '0.5.0', '0.5.0');
