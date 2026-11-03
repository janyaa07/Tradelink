-- Notification service functions (M0, docs/PLAN.md section 6). The server writes every notification,
-- alert and device change with the secret key (app.rs_require_system()); the policy itself (quiet
-- hours, daily limit, merge, mute, urgent bypass) lives in src/notifications/policy.ts.

-- A push row remembers the item it is about (for the same-item-same-day merge) and its shop alert.
alter table public.notification
  add column item_key text check (length(item_key) <= 120),
  add column alert_id uuid references public.alert (id) on delete set null;

create index notification_push_sent_idx on public.notification (user_id, type, sent_at desc) where channel = 'push';
create index alert_item_idx on public.alert (shop_id, item_key, created_at desc) where item_key is not null;

-- The instant today began in Singapore.
create function app.rs_sg_day_start() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('day', now() at time zone 'Asia/Singapore') at time zone 'Asia/Singapore'
$$;

-- Card states that mean the person already acted on the card, so its push was not ignored.
create function app.rs_card_acted(p_state text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_state in ('confirmed', 'accepted', 'partial', 'rejected', 'done', 'undone'), false)
$$;

-- Notifications -----------------------------------------------------------------------------------

-- One notification row: the in-app entry, or one push attempt. Returns its id.
create function public.rs_notification_put(p_notification jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_status text := coalesce(p_notification ->> 'status', 'PENDING');
  v_release timestamptz := (p_notification ->> 'release_at')::timestamptz;
begin
  perform app.rs_require_system();
  if coalesce(p_notification ->> 'type', '') !~ '^[a-z][a-z0-9_]{1,60}$' then
    raise exception 'TL400:INVALID_INPUT:notification type';
  end if;
  if v_status not in ('PENDING', 'HELD', 'SENT', 'SKIPPED') then
    raise exception 'TL400:INVALID_INPUT:status %', v_status;
  end if;
  if v_status = 'HELD' and v_release is null then
    raise exception 'TL400:INVALID_INPUT:a held notification needs release_at';
  end if;

  insert into public.notification (
    user_id, shop_id, supplier_id, type, channel, prompt_kind, card_id, title, body, url,
    status, release_at, sent_at, error, item_key, alert_id)
  values (
    (p_notification ->> 'user_id')::uuid, (p_notification ->> 'shop_id')::uuid, (p_notification ->> 'supplier_id')::uuid,
    p_notification ->> 'type', coalesce(p_notification ->> 'channel', 'in_app'),
    coalesce(p_notification ->> 'prompt_kind', 'prompted'), (p_notification ->> 'card_id')::uuid,
    left(coalesce(p_notification ->> 'title', ''), 200), left(coalesce(p_notification ->> 'body', ''), 500),
    left(p_notification ->> 'url', 500), v_status, v_release, case when v_status = 'SENT' then now() end,
    left(p_notification ->> 'error', 500), left(p_notification ->> 'item_key', 120), (p_notification ->> 'alert_id')::uuid)
  returning id into v_id;
  return v_id;
end $$;

-- Records what happened to one notification: sent, failed, skipped, or held until p_release_at.
create function public.rs_notification_update(p_id uuid, p_status text, p_error text default null, p_release_at timestamptz default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  if p_status not in ('PENDING', 'HELD', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED') then
    raise exception 'TL400:INVALID_INPUT:status %', p_status;
  end if;
  if p_status = 'HELD' and p_release_at is null then
    raise exception 'TL400:INVALID_INPUT:a held notification needs release_at';
  end if;
  update public.notification n
  set status = p_status,
      sent_at = case when p_status = 'SENT' then now() else n.sent_at end,
      error = left(p_error, 500),
      release_at = coalesce(p_release_at, n.release_at)
  where n.id = p_id;
  if not found then
    raise exception 'TL404:NOT_FOUND:notification %', p_id;
  end if;
end $$;

-- Claims held pushes whose release time has passed, for the notify.release job. A claimed row is
-- PENDING with release_at = now(); one left PENDING for 10 minutes (a crashed runner) is claimed again.
-- Returns the rows with their card's state so the job can re-check before sending.
create function public.rs_notification_claim_held(p_limit int default 50)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_rows jsonb;
begin
  perform app.rs_require_system();
  with claimed as (
    update public.notification n
    set status = 'PENDING', release_at = now()
    where n.id in (
      select q.id from public.notification q
      where q.channel = 'push'
        and ((q.status = 'HELD' and q.release_at <= now())
          or (q.status = 'PENDING' and q.release_at < now() - interval '10 minutes'))
      order by q.release_at
      limit least(greatest(p_limit, 1), 100)
      for update skip locked)
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'user_id', c.user_id, 'shop_id', c.shop_id, 'type', c.type, 'prompt_kind', c.prompt_kind,
      'title', c.title, 'body', c.body, 'url', c.url, 'item_key', c.item_key, 'alert_id', c.alert_id,
      'card_id', c.card_id, 'card_state', ci.state, 'opened_at', c.opened_at)), '[]'::jsonb)
  into v_rows
  from claimed c left join public.card_instance ci on ci.id = c.card_id;
  return v_rows;
end $$;

-- Everything the policy needs for one push to one person: preferences, today's unprompted pushes,
-- the ignored streak for this type, whether this item was already pushed today, the shop's quiet
-- hours, and the person's live push subscriptions.
--
-- The ignored streak counts this type's most recent sent pushes (at least an hour old, sent after the
-- person last changed their preferences, so unmuting starts afresh) that were neither opened nor acted
-- on, stopping at the first one that was.
create function public.rs_notify_context(p_user uuid, p_shop uuid, p_type text, p_item_key text default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pref public.notification_pref;
  v_default int;
  v_day_start timestamptz := app.rs_sg_day_start();
  v_quiet_start text;
  v_quiet_end text;
  v_unprompted int;
  v_streak int;
  v_same_item boolean := false;
  v_devices jsonb;
begin
  perform app.rs_require_system();
  select * into v_pref from public.notification_pref p where p.user_id = p_user;
  select (s.value #>> '{}')::int into v_default from public.app_setting s where s.key = 'notify.daily_unprompted_limit';

  if p_shop is not null then
    select to_char(s.quiet_start, 'HH24:MI'), to_char(s.quiet_end, 'HH24:MI') into v_quiet_start, v_quiet_end
    from public.shop s where s.id = p_shop;
  end if;

  select count(*) into v_unprompted from public.notification n
  where n.user_id = p_user and n.channel = 'push' and n.prompt_kind = 'unprompted'
    and n.status in ('SENT', 'DELIVERED') and n.sent_at >= v_day_start;

  with recent as (
    select n.opened_at is null and not app.rs_card_acted(ci.state) as ignored,
           row_number() over (order by n.sent_at desc) as rn
    from public.notification n left join public.card_instance ci on ci.id = n.card_id
    where n.user_id = p_user and n.type = p_type and n.channel = 'push' and n.status in ('SENT', 'DELIVERED')
      and n.sent_at < now() - interval '1 hour'
      and n.sent_at > coalesce(v_pref.updated_at, '-infinity'::timestamptz)
    order by n.sent_at desc
    limit 10
  )
  select coalesce(min(r.rn) filter (where not r.ignored) - 1, count(*))::int into v_streak from recent r;

  if p_item_key is not null then
    select exists (
      select 1 from public.notification n
      where n.user_id = p_user and n.channel = 'push' and n.item_key = p_item_key
        and n.status in ('SENT', 'DELIVERED', 'HELD') and coalesce(n.sent_at, n.created_at) >= v_day_start
    ) into v_same_item;
  end if;

  select coalesce(jsonb_agg(d.push_subscription order by d.last_seen_at desc), '[]'::jsonb) into v_devices
  from public.device d
  where d.user_id = p_user and d.push_allowed and d.push_subscription is not null and d.signed_out_at is null;

  return jsonb_build_object(
    'daily_limit', coalesce(v_pref.daily_limit, v_default, 2),
    'unprompted_today', v_unprompted,
    'muted_types', to_jsonb(coalesce(v_pref.muted_types, '{}')),
    'push_off_types', to_jsonb(coalesce(v_pref.push_off_types, '{}')),
    'ignored_streak', v_streak,
    'same_item_today', v_same_item,
    'quiet_start', v_quiet_start,
    'quiet_end', v_quiet_end,
    'devices', v_devices);
end $$;

-- Mutes a type for one person after it was ignored 3 times in a row.
create function public.rs_notify_mute(p_user uuid, p_type text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  if coalesce(p_type, '') !~ '^[a-z][a-z0-9_]{1,60}$' then
    raise exception 'TL400:INVALID_INPUT:notification type';
  end if;
  insert into public.notification_pref (user_id, daily_limit, muted_types)
  values (p_user,
          coalesce((select (s.value #>> '{}')::int from public.app_setting s where s.key = 'notify.daily_unprompted_limit'), 2),
          array[p_type])
  on conflict (user_id) do update
    set muted_types = case when p_type = any (public.notification_pref.muted_types)
                           then public.notification_pref.muted_types
                           else public.notification_pref.muted_types || p_type end,
        updated_at = now();
  perform app.rs_event('notify.muted', null, null, 'app_user', p_user, jsonb_build_object('type', p_type));
end $$;

-- The push service said this subscription no longer exists (404 or 410): stop pushing to it.
create function public.rs_device_push_gone(p_endpoint text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  update public.device d
  set push_subscription = null, push_allowed = false
  where d.push_subscription ->> 'endpoint' = p_endpoint;
end $$;

-- Alerts --------------------------------------------------------------------------------------------

-- Adds an alert to the shop's Alerts inbox. A normal alert about an item that already has an alert
-- today (Singapore day) is stored as MERGED into the first one. Returns the surviving alert's id.
create function public.rs_alert_put(p_alert jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := (p_alert ->> 'shop_id')::uuid;
  v_item text := left(p_alert ->> 'item_key', 120);
  v_priority text := coalesce(p_alert ->> 'priority', 'normal');
  v_existing uuid;
  v_id uuid;
begin
  perform app.rs_require_system();
  if v_shop is null then
    raise exception 'TL400:INVALID_INPUT:shop_id is required';
  end if;
  if coalesce(p_alert ->> 'type', '') !~ '^[a-z][a-z0-9_]{1,60}$' then
    raise exception 'TL400:INVALID_INPUT:alert type';
  end if;

  if v_item is not null and v_priority = 'normal' then
    perform pg_advisory_xact_lock(hashtextextended('alert:' || v_shop::text || ':' || v_item, 0));
    select a.id into v_existing from public.alert a
    where a.shop_id = v_shop and a.item_key = v_item and a.merged_into is null and a.status <> 'MERGED'
      and a.created_at >= app.rs_sg_day_start()
    order by a.created_at
    limit 1;
  end if;

  insert into public.alert (shop_id, type, priority, status, item_key, card_id, merged_into)
  values (v_shop, p_alert ->> 'type', v_priority, case when v_existing is null then 'QUEUED' else 'MERGED' end,
          v_item, (p_alert ->> 'card_id')::uuid, v_existing)
  returning id into v_id;
  return jsonb_build_object('id', coalesce(v_existing, v_id), 'merged', v_existing is not null);
end $$;

-- Moves an alert on. SENT wins over MUTED, which wins over QUEUED; a MERGED alert never changes.
create function public.rs_alert_update(p_id uuid, p_status text, p_release_at timestamptz default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.rs_require_system();
  if p_status not in ('QUEUED', 'SENT', 'MUTED') then
    raise exception 'TL400:INVALID_INPUT:status %', p_status;
  end if;
  update public.alert a
  set status = case
        when a.status = 'MERGED' then a.status
        when p_status = 'SENT' or a.status = 'QUEUED' then p_status
        else a.status end,
      release_at = coalesce(p_release_at, a.release_at)
  where a.id = p_id;
end $$;

-- Permissions: nothing for anon; every function checks its own caller.
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'rs_notification_put(jsonb)', 'rs_notification_update(uuid, text, text, timestamptz)',
    'rs_notification_claim_held(int)', 'rs_notify_context(uuid, uuid, text, text)', 'rs_notify_mute(uuid, text)',
    'rs_device_push_gone(text)', 'rs_alert_put(jsonb)', 'rs_alert_update(uuid, text, timestamptz)']
  loop
    execute format('revoke all on function public.%s from public, anon', v_fn);
    execute format('revoke all on function public.%s from authenticated', v_fn);
    execute format('grant execute on function public.%s to service_role', v_fn);
  end loop;
end $$;
