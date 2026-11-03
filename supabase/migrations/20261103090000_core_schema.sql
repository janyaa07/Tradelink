-- Tradelink core schema: tenancy, catalogue, inventory ledger, orders, issues, notifications and audit.
-- Reads are protected by RLS. Writes happen only through security definer functions (ADR 0004).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app;
grant usage on schema app to authenticated;

-- Tenancy ------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('buyer', 'supplier', 'platform')),
  name text not null check (length(name) between 2 and 120),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'declined')),
  contact_name text,
  phone text,
  email text,
  address text,
  invited_by_org_id uuid references public.organisations (id),
  joined_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index organisations_kind_name_key on public.organisations (kind, lower(name));

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id),
  created_at timestamptz not null default now()
);
create index memberships_org_idx on public.memberships (organisation_id);

create table public.buyer_settings (
  organisation_id uuid primary key references public.organisations (id),
  trading_hours text,
  weekly_budget numeric(12, 2) not null default 900 check (weekly_budget > 0),
  suggest_reorder boolean not null default true,
  price_alerts boolean not null default true,
  budget_warning boolean not null default true
);

create table public.supplier_profiles (
  organisation_id uuid primary key references public.organisations (id),
  product_range text,
  delivery_days smallint[] not null default '{1,2,3,4,5,6}',
  lead_time_days smallint not null default 1 check (lead_time_days between 0 and 14),
  lead_time_note text,
  cutoff_time time not null default '16:00',
  minimum_order numeric(12, 2) not null default 0 check (minimum_order >= 0),
  bank_last4 text check (bank_last4 ~ '^[0-9]{4}$')
);

create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  team text not null default 'Order desk',
  shift text not null default 'Mon to Fri, 09:00 to 18:00'
);

create table public.trading_connections (
  id uuid primary key default gen_random_uuid(),
  buyer_org_id uuid not null references public.organisations (id),
  supplier_org_id uuid not null references public.organisations (id),
  status text not null default 'active' check (status in ('invited', 'active', 'declined', 'ended')),
  created_at timestamptz not null default now(),
  unique (buyer_org_id, supplier_org_id)
);
create index trading_connections_supplier_idx on public.trading_connections (supplier_org_id);

-- Catalogue and inventory ----------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_org_id uuid not null references public.organisations (id),
  sku text not null,
  name text not null check (length(name) between 2 and 80),
  unit text not null check (unit in ('bag', 'bottle', 'box', 'can', 'carton', 'pack', 'packet', 'tin', 'tray', 'tub')),
  price numeric(12, 2) not null check (price > 0 and price <= 99999),
  category text not null default 'supplies' check (category in ('fresh', 'dry_goods', 'oils_sauces', 'supplies')),
  art text not null default 'box' check (art in ('egg', 'sack', 'bottle', 'tin', 'packet', 'box', 'tub', 'block', 'leaf', 'soap')),
  pack_kg numeric(8, 3) check (pack_kg is null or pack_kg > 0),
  reorder_level integer not null default 0 check (reorder_level between 0 and 99999),
  aliases text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'unconfirmed', 'hidden')),
  added_by_org_id uuid references public.organisations (id),
  created_at timestamptz not null default now()
);
create unique index products_supplier_name_key on public.products (supplier_org_id, lower(name));
create unique index products_supplier_sku_key on public.products (supplier_org_id, sku);

create table public.inventory_levels (
  product_id uuid primary key references public.products (id),
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  constraint reserved_within_on_hand check (reserved <= on_hand)
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id),
  type text not null check (type in ('received', 'reserved', 'released', 'delivered', 'adjusted')),
  on_hand_change integer not null,
  reserved_change integer not null,
  on_hand_after integer not null,
  reserved_after integer not null,
  reason text check (reason in ('damaged', 'expired', 'count_correction', 'opening_stock')),
  order_id uuid,
  source text not null,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

create table public.price_changes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  old_price numeric(12, 2) not null,
  new_price numeric(12, 2) not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index price_changes_product_idx on public.price_changes (product_id);

create table public.price_change_acks (
  price_change_id uuid not null references public.price_changes (id),
  buyer_org_id uuid not null references public.organisations (id),
  acked_at timestamptz not null default now(),
  primary key (price_change_id, buyer_org_id)
);

-- Ordering -------------------------------------------------------------------

create table public.order_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  buyer_org_id uuid not null references public.organisations (id),
  lines jsonb not null default '[]',
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

create sequence public.order_number_seq start 1044;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  buyer_org_id uuid not null references public.organisations (id),
  supplier_org_id uuid not null references public.organisations (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'out_for_delivery', 'delivered', 'rejected', 'cancelled')),
  requested_delivery_date date,
  confirmed_delivery_date date,
  delivered_at timestamptz,
  check_status text not null default 'unchecked' check (check_status in ('unchecked', 'all_here', 'problem')),
  placed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_org_id, created_at desc);
create index orders_supplier_idx on public.orders (supplier_org_id, status);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  product_id uuid not null references public.products (id),
  qty integer not null check (qty > 0 and qty <= 9999),
  asked_qty integer not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  held boolean not null default true,
  source_text text
);
create index order_lines_order_idx on public.order_lines (order_id);
create index order_lines_product_idx on public.order_lines (product_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id),
  from_status text,
  to_status text not null,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id);

create table public.partial_fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  product_id uuid not null references public.products (id),
  asked integer not null,
  sent integer not null,
  status text not null default 'new' check (status in ('new', 'added', 'skipped')),
  created_at timestamptz not null default now()
);
create index partial_fulfilments_order_idx on public.partial_fulfilments (order_id);

create table public.usual_items (
  buyer_org_id uuid not null references public.organisations (id),
  product_id uuid not null references public.products (id),
  usual_qty integer not null default 1 check (usual_qty between 1 and 9999),
  use_per_day numeric(10, 3) not null default 1 check (use_per_day >= 0),
  in_shop numeric(10, 3) not null default 0 check (in_shop >= 0),
  last_paid numeric(12, 2),
  primary key (buyer_org_id, product_id)
);

create table public.restock_skips (
  buyer_org_id uuid not null references public.organisations (id),
  product_id uuid not null references public.products (id),
  skip_date date not null,
  primary key (buyer_org_id, product_id, skip_date)
);

-- After delivery ---------------------------------------------------------------

create sequence public.issue_number_seq start 302;
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.issue_number_seq'),
  order_id uuid not null references public.orders (id),
  buyer_org_id uuid not null references public.organisations (id),
  supplier_org_id uuid not null references public.organisations (id),
  product_id uuid references public.products (id),
  type text not null check (type in ('short', 'damaged', 'wrong_item', 'expired', 'late', 'invoice')),
  qty integer not null default 0,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  note text check (length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'credit_promised', 'replacement_promised', 'supplier_replied', 'disputed', 'closed', 'credit_received')),
  buyer_seen boolean not null default true,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index issues_one_open_late on public.issues (order_id) where type = 'late' and status = 'open';
create index issues_buyer_idx on public.issues (buyer_org_id);
create index issues_supplier_idx on public.issues (supplier_org_id);

-- Platform -------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_org_id uuid not null references public.organisations (id),
  kind text not null,
  title text not null,
  body text not null,
  link text,
  subject_org_id uuid references public.organisations (id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_org_id, created_at desc);

create table public.attention_states (
  item_key text primary key,
  assigned_user_id uuid references auth.users (id),
  handled_at timestamptz,
  handled_by uuid
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_user_id uuid,
  actor_name text,
  actor_org_id uuid,
  actor_org_name text,
  actor_role text,
  action text not null,
  related_org_ids uuid[] not null default '{}',
  outcome text not null default 'allowed' check (outcome in ('allowed', 'denied')),
  metadata jsonb not null default '{}'
);
create index audit_log_related_idx on public.audit_log using gin (related_org_ids);
create index audit_log_at_idx on public.audit_log (at desc);

create table public.idempotency_keys (
  user_id uuid not null,
  action text not null,
  key uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, action, key)
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  organisation_id uuid references public.organisations (id),
  user_id uuid,
  feature text not null check (feature in ('order_read', 'invoice_read', 'ask', 'negotiation_draft')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer not null default 0,
  outcome text not null check (outcome in ('ok', 'fallback', 'refusal', 'timeout', 'error', 'invalid_output')),
  lines_read integer not null default 0,
  lines_matched integer not null default 0,
  created_at timestamptz not null default now()
);

-- State machines (ADR 0007) ------------------------------------------------------------

create table app.state_transitions (
  entity text not null,
  from_status text not null,
  to_status text not null,
  primary key (entity, from_status, to_status)
);
insert into app.state_transitions (entity, from_status, to_status) values
  ('order', 'pending', 'accepted'),
  ('order', 'pending', 'rejected'),
  ('order', 'pending', 'cancelled'),
  ('order', 'accepted', 'out_for_delivery'),
  ('order', 'out_for_delivery', 'delivered'),
  ('issue', 'open', 'credit_promised'),
  ('issue', 'open', 'replacement_promised'),
  ('issue', 'open', 'supplier_replied'),
  ('issue', 'open', 'disputed'),
  ('issue', 'disputed', 'credit_promised'),
  ('issue', 'disputed', 'closed'),
  ('issue', 'credit_promised', 'credit_received'),
  ('organisation', 'invited', 'active'),
  ('organisation', 'invited', 'declined'),
  ('organisation', 'active', 'suspended'),
  ('organisation', 'suspended', 'active');

create function app.guard_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status and not exists (
    select 1 from app.state_transitions t
    where t.entity = tg_argv[0] and t.from_status = old.status and t.to_status = new.status
  ) then
    raise exception 'TL409:INVALID_TRANSITION:% from % to %', tg_argv[0], old.status, new.status;
  end if;
  return new;
end $$;

create trigger orders_guard_status before update of status on public.orders
  for each row execute function app.guard_status('order');
create trigger issues_guard_status before update of status on public.issues
  for each row execute function app.guard_status('issue');
create trigger organisations_guard_status before update of status on public.organisations
  for each row execute function app.guard_status('organisation');

-- Append-only tables ----------------------------------------------------------------------

create function app.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'TL403:APPEND_ONLY:% cannot be changed or deleted', tg_table_name;
end $$;

create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function app.forbid_change();
create trigger stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function app.forbid_change();
create trigger price_changes_append_only before update or delete on public.price_changes
  for each row execute function app.forbid_change();
create trigger order_events_append_only before update or delete on public.order_events
  for each row execute function app.forbid_change();

-- RLS helpers ----------------------------------------------------------------------------------

create function app.my_org_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.organisation_id from public.memberships m where m.user_id = auth.uid()
$$;

create function app.my_org_kind() returns text
language sql stable security definer set search_path = '' as $$
  select o.kind from public.memberships m join public.organisations o on o.id = m.organisation_id
  where m.user_id = auth.uid()
$$;

-- Admins are members of the platform organisation. Two-factor (aal2) is added to this check
-- when two-factor sign-in ships; every admin policy and function goes through this one function.
create function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_org_kind() = 'platform', false)
$$;

create function app.connected(p_buyer uuid, p_supplier uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trading_connections c
    where c.buyer_org_id = p_buyer and c.supplier_org_id = p_supplier and c.status in ('invited', 'active')
  )
$$;

create function app.can_see_org(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_org = app.my_org_id()
    or app.is_admin()
    or app.connected(app.my_org_id(), p_org)
    or app.connected(p_org, app.my_org_id())
$$;

create function app.can_see_product(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p join public.organisations s on s.id = p.supplier_org_id
    where p.id = p_product and (
      app.is_admin()
      or p.supplier_org_id = app.my_org_id()
      or (p.status in ('active', 'unconfirmed') and s.status in ('active', 'invited')
          and app.connected(app.my_org_id(), p.supplier_org_id))
    )
  )
$$;

grant execute on all functions in schema app to authenticated;

-- RLS --------------------------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.buyer_settings enable row level security;
alter table public.supplier_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.trading_connections enable row level security;
alter table public.products enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.stock_movements enable row level security;
alter table public.price_changes enable row level security;
alter table public.price_change_acks enable row level security;
alter table public.order_drafts enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_events enable row level security;
alter table public.partial_fulfilments enable row level security;
alter table public.usual_items enable row level security;
alter table public.restock_skips enable row level security;
alter table public.issues enable row level security;
alter table public.notifications enable row level security;
alter table public.attention_states enable row level security;
alter table public.audit_log enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.rate_limits enable row level security;
alter table public.ai_usage enable row level security;

-- Select policies only. No insert, update or delete policies exist, so direct writes are refused.
create policy organisations_read on public.organisations for select to authenticated
  using (app.can_see_org(id));
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or app.is_admin() or exists (
    select 1 from public.memberships m where m.user_id = profiles.user_id and m.organisation_id = app.my_org_id()));
create policy memberships_read on public.memberships for select to authenticated
  using (organisation_id = app.my_org_id() or app.is_admin());
create policy buyer_settings_read on public.buyer_settings for select to authenticated
  using (organisation_id = app.my_org_id() or app.is_admin());
create policy supplier_profiles_read on public.supplier_profiles for select to authenticated
  using (app.can_see_org(organisation_id));
create policy admin_profiles_read on public.admin_profiles for select to authenticated
  using (app.is_admin());
create policy trading_connections_read on public.trading_connections for select to authenticated
  using (buyer_org_id = app.my_org_id() or supplier_org_id = app.my_org_id() or app.is_admin());
create policy products_read on public.products for select to authenticated
  using (app.can_see_product(id));
create policy inventory_levels_read on public.inventory_levels for select to authenticated
  using (app.can_see_product(product_id));
create policy stock_movements_read on public.stock_movements for select to authenticated
  using (app.is_admin() or exists (
    select 1 from public.products p where p.id = stock_movements.product_id and p.supplier_org_id = app.my_org_id()));
create policy price_changes_read on public.price_changes for select to authenticated
  using (app.can_see_product(product_id));
create policy price_change_acks_read on public.price_change_acks for select to authenticated
  using (buyer_org_id = app.my_org_id() or app.is_admin());
create policy order_drafts_read on public.order_drafts for select to authenticated
  using (user_id = auth.uid());
create policy orders_read on public.orders for select to authenticated
  using (buyer_org_id = app.my_org_id() or supplier_org_id = app.my_org_id() or app.is_admin());
create policy order_lines_read on public.order_lines for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_lines.order_id));
create policy order_events_read on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_events.order_id));
create policy partial_fulfilments_read on public.partial_fulfilments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = partial_fulfilments.order_id));
create policy usual_items_read on public.usual_items for select to authenticated
  using (buyer_org_id = app.my_org_id() or app.is_admin());
create policy restock_skips_read on public.restock_skips for select to authenticated
  using (buyer_org_id = app.my_org_id());
create policy issues_read on public.issues for select to authenticated
  using (buyer_org_id = app.my_org_id() or supplier_org_id = app.my_org_id() or app.is_admin());
create policy notifications_read on public.notifications for select to authenticated
  using (recipient_org_id = app.my_org_id());
create policy attention_states_read on public.attention_states for select to authenticated
  using (app.is_admin());
create policy audit_log_read on public.audit_log for select to authenticated
  using (app.is_admin() or app.my_org_id() = any (related_org_ids) or actor_org_id = app.my_org_id());
create policy ai_usage_read on public.ai_usage for select to authenticated
  using (app.is_admin());

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
grant select on all tables in schema public to authenticated;

-- Read models (security invoker, so RLS applies) ------------------------------------------------

create view public.v_catalogue with (security_invoker = true) as
select
  p.id, p.supplier_org_id, s.name as supplier_name, s.status as supplier_status,
  p.sku, p.name, p.unit, p.price, p.category, p.art, p.pack_kg, p.reorder_level, p.aliases, p.status,
  i.on_hand, i.reserved, i.on_hand - i.reserved as available,
  case
    when p.status = 'unconfirmed' then 'unconfirmed'
    when i.on_hand - i.reserved <= 0 then 'out'
    when i.on_hand - i.reserved <= p.reorder_level then 'low'
    else 'healthy'
  end as health
from public.products p
join public.inventory_levels i on i.product_id = p.id
join public.organisations s on s.id = p.supplier_org_id
where p.status <> 'hidden';

create view public.v_order_totals with (security_invoker = true) as
select o.id as order_id, coalesce(sum(l.qty * l.unit_price), 0)::numeric(12, 2) as total
from public.orders o left join public.order_lines l on l.order_id = o.id
group by o.id;

grant select on public.v_catalogue, public.v_order_totals to authenticated;
