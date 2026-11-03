-- Tradelink AI core schema (M0). Adds the Tradelink AI data model beside the Tradelink tables, which keep
-- serving the live app until each slice replaces them (docs/PLAN.md, section 3). Reserved words are
-- avoided: shop_order, shop_order_line, ops_case.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- People and access -----------------------------------------------------------------------------

create table public.app_user (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  full_name text not null default '' check (length(full_name) <= 120),
  language text not null default 'en' check (language in ('en', 'zh', 'ms', 'ta')),
  lead_source text check (length(lead_source) <= 80),
  default_mode text not null default 'shop' check (default_mode in ('shop', 'supplier', 'ops')),
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.device (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  platform text not null check (platform in ('web', 'ios', 'android')),
  push_subscription jsonb,
  push_allowed boolean not null default false,
  app_version text check (length(app_version) <= 40),
  last_seen_at timestamptz not null default now(),
  signed_out_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index device_push_endpoint_key on public.device ((push_subscription ->> 'endpoint')) where push_subscription is not null;

create table public.notification_pref (
  user_id uuid primary key references public.app_user (id) on delete cascade,
  daily_limit int not null default 2 check (daily_limit between 0 and 20),
  muted_types text[] not null default '{}',
  push_off_types text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.ops_member (
  user_id uuid primary key references public.app_user (id) on delete cascade,
  role text not null check (role in ('ops', 'gtm_helper', 'admin')),
  assigned_shop_ids uuid[],
  created_at timestamptz not null default now()
);

-- Shops and suppliers ----------------------------------------------------------------------------

create table public.shop (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  status text not null default 'ONBOARDING' check (status in ('ONBOARDING', 'LIVE')),
  paused_from date,
  paused_until date,
  place_id text,
  address text,
  postal_code text check (postal_code ~ '^[0-9]{6}$'),
  lat double precision,
  lng double precision,
  phone text,
  rest_day smallint check (rest_day between 1 and 7),
  quiet_start time not null default '22:00',
  quiet_end time not null default '06:00',
  staff_order_default text not null default 'hold' check (staff_order_default in ('send', 'hold')),
  licence_tobacco boolean not null default false,
  licence_liquor boolean not null default false,
  activation_status text check (activation_status in ('ACTIVE', 'AT_RISK')),
  referred_by text,
  created_at timestamptz not null default now(),
  check (paused_until is null or paused_from is not null and paused_until >= paused_from)
);

create table public.outlet (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shop (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  address text,
  place_id text,
  created_at timestamptz not null default now()
);

create table public.shop_member (
  shop_id uuid not null references public.shop (id) on delete cascade,
  user_id uuid not null references public.app_user (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  status text not null default 'ACTIVE' check (status in ('PENDING', 'ACTIVE', 'REMOVED')),
  active_from timestamptz not null default now(),
  confirm_cap_cents int check (confirm_cap_cents >= 0),
  view_access boolean not null default false,
  hide_prices boolean not null default false,
  full_control_until date,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index shop_member_user_idx on public.shop_member (user_id);

create table public.supplier (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  phone text,
  email text,
  place_id text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index supplier_place_key on public.supplier (place_id) where place_id is not null;
create unique index supplier_phone_key on public.supplier (phone) where phone is not null;

create table public.supplier_member (
  supplier_id uuid not null references public.supplier (id) on delete cascade,
  user_id uuid not null references public.app_user (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  status text not null default 'ACTIVE' check (status in ('PENDING', 'ACTIVE', 'REMOVED')),
  created_at timestamptz not null default now(),
  primary key (supplier_id, user_id)
);
create index supplier_member_user_idx on public.supplier_member (user_id);

create table public.shop_supplier (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shop (id) on delete cascade,
  supplier_id uuid not null references public.supplier (id) on delete restrict,
  status text not null default 'PENDING' check (status in ('PENDING', 'LIVE', 'OPTED_OUT')),
  cut_off time,
  delivery_days smallint[] not null default '{}' check (delivery_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  delivery_window_start time,
  delivery_window_end time,
  minimum_order_cents int check (minimum_order_cents >= 0),
  delivery_fee_cents int check (delivery_fee_cents >= 0),
  free_delivery_at_cents int check (free_delivery_at_cents >= 0),
  payment_terms text check (payment_terms in ('cod', '7d', '14d', '30d')),
  order_channel text not null default 'app' check (order_channel in ('app', 'web_link')),
  seen_counts_as_accepted boolean not null default false,
  intro_code text unique,
  ack_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, supplier_id)
);
create index shop_supplier_supplier_idx on public.shop_supplier (supplier_id);

create table public.consent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  shop_id uuid references public.shop (id) on delete cascade,
  supplier_id uuid references public.supplier (id) on delete cascade,
  type text not null check (type in ('terms', 'privacy_notice', 'utility_opt_in', 'marketing_opt_in', 'exact_item_rule', 'staff_privacy', 'opt_out')),
  version int not null default 1,
  method text not null default 'tap' check (method in ('tap', 'verbal')),
  recorded_by_name text,
  created_at timestamptz not null default now()
);
create index consent_user_idx on public.consent (user_id, type);

create table public.web_link (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier (id) on delete cascade,
  user_id uuid references public.app_user (id) on delete cascade,
  shop_id uuid references public.shop (id) on delete cascade,
  purpose text not null check (purpose in ('supplier_access', 'invite')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Items, prices and memory ----------------------------------------------------------------------

create table public.product (
  id uuid primary key default gen_random_uuid(),
  barcode text unique check (barcode ~ '^[0-9]{6,14}$'),
  brand text,
  name text not null check (length(name) between 1 and 160),
  variant text,
  pack_size text,
  pack_qty numeric(12, 3) check (pack_qty > 0),
  base_unit text,
  photos text[] not null default '{}',
  category text,
  halal boolean,
  regulated text check (regulated in ('tobacco', 'liquor')),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_name_trgm on public.product using gin ((coalesce(brand, '') || ' ' || name || ' ' || coalesce(variant, '') || ' ' || coalesce(pack_size, '')) extensions.gin_trgm_ops);

create table public.list_version (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shop (id) on delete cascade,
  n int not null check (n >= 1),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'LOCKED', 'SUPERSEDED', 'DISCARDED')),
  locked_at timestamptz,
  locked_by uuid references public.app_user (id),
  undo_until timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, n)
);

-- An item on a shop's list. valid_from/valid_to are list version numbers, so a sent order keeps the
-- exact item it was built from (US-51).
create table public.shop_item (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shop (id) on delete cascade,
  product_id uuid not null references public.product (id),
  supplier_id uuid references public.supplier (id),
  order_unit text not null default 'unit' check (length(order_unit) between 1 and 30),
  base_unit text,
  base_per_order numeric(12, 3) check (base_per_order > 0),
  billing_type text not null default 'fixed' check (billing_type in ('fixed', 'per_kg', 'market')),
  nicknames text[] not null default '{}',
  confirmed_words text[] not null default '{}',
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ORDERABLE', 'PENDING_CHECK', 'PENDING_OWNER', 'DISCONTINUED', 'REMOVED')),
  shelf_life_days int check (shelf_life_days > 0),
  no_substitutes boolean not null default false,
  valid_from int not null default 1,
  valid_to int,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create index shop_item_shop_idx on public.shop_item (shop_id) where valid_to is null;

create table public.catalogue_snapshot (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier (id) on delete cascade,
  items jsonb not null default '[]',
  source_file text,
  received_at timestamptz not null default now()
);

create table public.price_observation (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shop (id) on delete cascade,
  shop_item_id uuid not null references public.shop_item (id) on delete cascade,
  supplier_id uuid references public.supplier (id),
  price_cents int not null check (price_cents >= 0),
  unit text,
  source text not null check (source in ('onboarding', 'po', 'supplier_answer', 'notice', 'catalogue', 'quote', 'owner')),
  ref_id uuid,
  accepted boolean not null default true,
  observed_at timestamptz not null default now()
);
create index price_observation_item_idx on public.price_observation (shop_item_id, observed_at desc);

create table public.expected_price (
  shop_item_id uuid not null references public.shop_item (id) on delete cascade,
  supplier_id uuid not null references public.supplier (id),
  shop_id uuid not null references public.shop (id) on delete cascade,
  low_cents int not null check (low_cents >= 0),
  high_cents int not null check (high_cents >= low_cents),
  last_paid_cents int check (last_paid_cents >= 0),
  basis text not null default 'history',
  n_observations int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (shop_item_id, supplier_id)
);

create table public.usage_rate (
  shop_item_id uuid primary key references public.shop_item (id) on delete cascade,
  shop_id uuid not null references public.shop (id) on delete cascade,
  per_open_day numeric(12, 3) not null default 0 check (per_open_day >= 0),
  usual_qty int check (usual_qty >= 0),
  correction numeric(6, 3) not null default 1,
  in_usual boolean not null default true,
  n_deliveries int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.learned_fact (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shop (id) on delete cascade,
  kind text not null,
  text text not null check (length(text) <= 240),
  data jsonb not null default '{}',
  forgotten_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.calendar_event (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('public_holiday', 'school_holiday', 'festival', 'shop_closure', 'supplier_closure', 'supply_news')),
  shop_id uuid references public.shop (id) on delete cascade,
  supplier_id uuid references public.supplier (id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index calendar_event_dates_idx on public.calendar_event (starts_on, ends_on);

create table public.budget (
  shop_id uuid primary key references public.shop (id) on delete cascade,
  weekly_limit_cents int not null check (weekly_limit_cents > 0),
  updated_at timestamptz not null default now()
);

-- Shop orders -----------------------------------------------------------------------------------

create table public.shop_order (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shop (id) on delete cascade,
  outlet_id uuid references public.outlet (id),
  state text not null default 'DRAFT' check (state in ('DRAFT', 'AWAITING_CONFIRM', 'CONFIRMED', 'CANCELLED')),
  version int not null default 1 check (version >= 1),
  source text not null default 'chat' check (source in ('chat', 'usual', 'plan', 'standing', 'outside', 'manual')),
  urgent boolean not null default false,
  deadline timestamptz,
  list_version int,
  one_off boolean not null default false,
  created_by uuid references public.app_user (id),
  confirmed_by uuid references public.app_user (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shop_order_shop_idx on public.shop_order (shop_id, created_at desc);

create table public.shop_order_line (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_order (id) on delete cascade,
  position int not null,
  raw_text text not null default '' check (length(raw_text) <= 240),
  shop_item_id uuid references public.shop_item (id),
  qty int check (qty between 1 and 9999),
  hint_qty int check (hint_qty between 0 and 9999),
  picked_by uuid references public.app_user (id),
  picked_at timestamptz,
  pin_reason text check (pin_reason in ('exact', 'nickname', 'confirmed_word', 'barcode', 'past_order')),
  expected_price_cents int check (expected_price_cents >= 0),
  delivery_date date,
  status text not null default 'OPEN' check (status in ('OPEN', 'PICKED', 'SKIPPED', 'WAITING', 'HELD', 'SCHEDULED')),
  warnings jsonb not null default '[]',
  unique (order_id, position)
);

-- Every version of an order as it stood, so an older card can show what it showed (append-only).
create table public.shop_order_version (
  order_id uuid not null references public.shop_order (id) on delete cascade,
  version int not null,
  state text not null,
  lines jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (order_id, version)
);

-- Purchase orders --------------------------------------------------------------------------------

create sequence public.purchase_order_number_seq start 1000;

create table public.purchase_order (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.purchase_order_number_seq'),
  order_id uuid references public.shop_order (id) on delete set null,
  shop_id uuid not null references public.shop (id) on delete cascade,
  supplier_id uuid not null references public.supplier (id),
  version int not null default 1 check (version >= 1),
  state text not null default 'CONFIRMED' check (state in (
    'CONFIRMED', 'SCHEDULED', 'SENT', 'ACCEPTED', 'PARTIAL', 'REJECTED', 'NO_REPLY', 'REPLACED', 'CANCELLED',
    'LATE', 'ISSUE', 'RECEIVED', 'RECEIVED_UNCONFIRMED', 'DISPUTED')),
  channel text not null default 'app' check (channel in ('app', 'web_link', 'phone', 'outside')),
  delivery_date date,
  eta timestamptz,
  urgent boolean not null default false,
  send_at timestamptz,
  sent_at timestamptz,
  seen_at timestamptz,
  accepted_at timestamptz,
  accepted_version int,
  received_at timestamptz,
  reason text check (length(reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index purchase_order_order_supplier_key on public.purchase_order (order_id, supplier_id) where order_id is not null;
create index purchase_order_supplier_idx on public.purchase_order (supplier_id, created_at desc);
create index purchase_order_shop_idx on public.purchase_order (shop_id, created_at desc);

create table public.po_line (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_order (id) on delete cascade,
  version int not null,
  position int not null,
  shop_item_id uuid not null references public.shop_item (id),
  item_name text not null,
  order_unit text not null,
  qty int not null check (qty between 1 and 9999),
  price_cents int check (price_cents >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'CHANGED', 'UNAVAILABLE', 'SUBSTITUTE_OFFERED', 'HELD', 'CANCELLED')),
  changed_qty int check (changed_qty between 0 and 9999),
  note text check (length(note) <= 500),
  unique (po_id, version, position)
);

create table public.supplier_reply (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_order (id) on delete cascade,
  po_version int not null,
  source text not null check (source in ('tap', 'note', 'web_link', 'phone', 'ops', 'owner')),
  actor_user_id uuid references public.app_user (id),
  person_name text,
  payload jsonb not null default '{}',
  raw_note text check (length(raw_note) <= 2000),
  confidence numeric(4, 3) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

-- Chat, cards and the agent -----------------------------------------------------------------------

create table public.chat_thread (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('shop', 'supplier', 'support', 'ops_onboarding')),
  shop_id uuid references public.shop (id) on delete cascade,
  supplier_id uuid references public.supplier (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (kind <> 'shop' or shop_id is not null),
  check (kind <> 'supplier' or supplier_id is not null)
);
create unique index chat_thread_shop_key on public.chat_thread (shop_id) where kind = 'shop';
create unique index chat_thread_supplier_key on public.chat_thread (supplier_id) where kind = 'supplier';

create table public.chat_message (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_thread (id) on delete cascade,
  client_message_id text check (length(client_message_id) between 8 and 64),
  author_kind text not null check (author_kind in ('owner', 'staff', 'supplier', 'agent', 'ops', 'system')),
  author_user_id uuid references public.app_user (id),
  body text not null default '' check (length(body) <= 4000),
  attachments jsonb not null default '[]',
  reply_to uuid references public.chat_message (id),
  card_id uuid,
  created_at timestamptz not null default now(),
  unique (thread_id, client_message_id)
);
create index chat_message_thread_idx on public.chat_message (thread_id, created_at);

create table public.card_instance (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type ~ '^[a-z][a-z0-9_]{1,40}$'),
  schema_version int not null default 1,
  audience text not null check (audience in ('shop', 'supplier', 'ops')),
  shop_id uuid references public.shop (id) on delete cascade,
  supplier_id uuid references public.supplier (id) on delete cascade,
  subject_kind text not null check (subject_kind ~ '^[a-z][a-z_]{1,40}$'),
  subject_id uuid not null,
  subject_version int not null default 1,
  state text not null check (state in (
    'draft', 'awaiting_confirm', 'confirmed', 'sent', 'seen', 'accepted', 'partial', 'rejected',
    'superseded', 'expired', 'done', 'undone', 'open')),
  data jsonb not null,
  actions jsonb not null default '[]',
  reason jsonb,
  question jsonb,
  surfaces text[] not null default '{chat}' check (surfaces <@ array['chat', 'alerts', 'screen']),
  thread_id uuid references public.chat_thread (id) on delete set null,
  created_by text not null default 'agent' check (created_by in ('agent', 'user', 'system')),
  superseded_by uuid references public.card_instance (id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (audience <> 'shop' or shop_id is not null),
  check (audience <> 'supplier' or supplier_id is not null)
);
create index card_instance_subject_idx on public.card_instance (subject_kind, subject_id, subject_version desc);
create index card_instance_shop_idx on public.card_instance (shop_id, created_at desc);
create index card_instance_supplier_idx on public.card_instance (supplier_id, created_at desc);
alter table public.chat_message add constraint chat_message_card_fk foreign key (card_id) references public.card_instance (id) on delete set null;

create table public.agent_action (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shop (id) on delete cascade,
  supplier_id uuid references public.supplier (id) on delete cascade,
  agent text not null check (agent in ('AG0', 'AG1', 'AG2', 'AG3', 'AG4', 'AG5', 'AG6', 'AG7', 'GW', 'OPS', 'USER')),
  action text not null check (length(action) between 1 and 80),
  subject_kind text,
  subject_id uuid,
  inputs jsonb not null default '{}',
  rule text,
  confidence numeric(4, 3) check (confidence between 0 and 1),
  band text check (band in ('high', 'medium', 'low')),
  outcome text not null default 'done' check (outcome in ('done', 'asked', 'handed_off', 'refused', 'failed')),
  actor_user_id uuid references public.app_user (id),
  undo_until timestamptz,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index agent_action_shop_idx on public.agent_action (shop_id, created_at desc);

create table public.autonomy_setting (
  shop_id uuid not null references public.shop (id) on delete cascade,
  area text not null check (area in ('shop_orders', 'supplier_problems')),
  level smallint not null default 1 check (level between 0 and 3),
  limit_cents int not null default 5000 check (limit_cents >= 0),
  temporary_level smallint check (temporary_level between 0 and 3),
  restore_at timestamptz,
  set_by uuid references public.app_user (id),
  set_at timestamptz not null default now(),
  primary key (shop_id, area)
);

create table public.alert (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shop (id) on delete cascade,
  type text not null,
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  status text not null default 'QUEUED' check (status in ('QUEUED', 'SENT', 'MERGED', 'MUTED')),
  item_key text,
  card_id uuid references public.card_instance (id) on delete set null,
  merged_into uuid references public.alert (id),
  release_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  shop_id uuid references public.shop (id) on delete cascade,
  supplier_id uuid references public.supplier (id) on delete cascade,
  type text not null,
  channel text not null check (channel in ('in_app', 'push', 'email', 'sms')),
  prompt_kind text not null default 'prompted' check (prompt_kind in ('prompted', 'unprompted', 'urgent')),
  card_id uuid references public.card_instance (id) on delete set null,
  title text not null default '',
  body text not null default '',
  url text,
  status text not null default 'PENDING' check (status in ('PENDING', 'HELD', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED')),
  release_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index notification_user_idx on public.notification (user_id, created_at desc);
create index notification_pending_idx on public.notification (status, release_at) where status in ('PENDING', 'HELD');

create table public.notification_type (
  name text not null check (name ~ '^[a-z][a-z0-9_]{1,60}$'),
  language text not null check (language in ('en', 'zh', 'ms', 'ta')),
  channel text not null default 'push' check (channel in ('push', 'email', 'sms')),
  title text not null check (length(title) <= 65),
  body text not null check (length(body) <= 178),
  version int not null default 1,
  primary key (name, language)
);

-- Ops, jobs and events ----------------------------------------------------------------------------

create table public.ops_case (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type ~ '^[A-Za-z_]{2,40}$'),
  shop_id uuid references public.shop (id) on delete cascade,
  supplier_id uuid references public.supplier (id) on delete cascade,
  po_id uuid references public.purchase_order (id) on delete set null,
  due_at timestamptz,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLAIMED', 'CLOSED')),
  assignee uuid references public.app_user (id),
  claimed_at timestamptz,
  ai_paused boolean not null default false,
  blocking boolean not null default false,
  reason_code text,
  ops_minutes int check (ops_minutes >= 0),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index ops_case_open_idx on public.ops_case (status, due_at);

-- Every timer in the sheet is a job. dedupe_key makes scheduling idempotent; a job re-checks its
-- subject before acting, so a cancelled or answered PO is never chased (EC28).
create table public.job (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind ~ '^[a-z][a-z0-9_.]{1,60}$'),
  run_at timestamptz not null,
  dedupe_key text unique,
  payload jsonb not null default '{}',
  status text not null default 'PENDING' check (status in ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED')),
  attempts int not null default 0,
  last_error text,
  locked_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index job_due_idx on public.job (run_at) where status = 'PENDING';

create table public.event (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[a-z][a-z0-9_.]{1,60}$'),
  shop_id uuid,
  supplier_id uuid,
  actor_user_id uuid,
  subject_kind text,
  subject_id uuid,
  props jsonb not null default '{}',
  client_event_id text unique,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);
create index event_name_idx on public.event (name, occurred_at desc);

create table public.app_release (
  platform text primary key check (platform in ('web', 'ios', 'android')),
  version text not null,
  min_version text not null,
  updated_at timestamptz not null default now()
);

-- Tunable thresholds (docs/PLAN.md, section 10), read by agents and the notification service.
create table public.app_setting (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Append-only and state machines -------------------------------------------------------------------

create trigger price_observation_append_only before update or delete on public.price_observation
  for each row execute function app.forbid_change();
create trigger shop_order_version_append_only before update or delete on public.shop_order_version
  for each row execute function app.forbid_change();
create trigger supplier_reply_append_only before update or delete on public.supplier_reply
  for each row execute function app.forbid_change();
create trigger consent_append_only before update or delete on public.consent
  for each row execute function app.forbid_change();
create trigger event_append_only before update or delete on public.event
  for each row execute function app.forbid_change();

-- agent_action is append-only except that undone_at may be set once.
create function app.rs_agent_action_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'TL403:APPEND_ONLY:agent_action cannot be deleted';
  end if;
  if old.undone_at is not null
     or (to_jsonb(new) - 'undone_at') is distinct from (to_jsonb(old) - 'undone_at') then
    raise exception 'TL403:APPEND_ONLY:agent_action can only be marked undone once';
  end if;
  return new;
end $$;
create trigger agent_action_guard before update or delete on public.agent_action
  for each row execute function app.rs_agent_action_guard();

insert into app.state_transitions (entity, from_status, to_status) values
  ('shop_order', 'DRAFT', 'AWAITING_CONFIRM'),
  ('shop_order', 'AWAITING_CONFIRM', 'DRAFT'),
  ('shop_order', 'AWAITING_CONFIRM', 'CONFIRMED'),
  ('shop_order', 'DRAFT', 'CANCELLED'),
  ('shop_order', 'AWAITING_CONFIRM', 'CANCELLED'),
  ('purchase_order', 'CONFIRMED', 'SCHEDULED'),
  ('purchase_order', 'CONFIRMED', 'SENT'),
  ('purchase_order', 'SCHEDULED', 'SENT'),
  ('purchase_order', 'CONFIRMED', 'CANCELLED'),
  ('purchase_order', 'SCHEDULED', 'CANCELLED'),
  ('purchase_order', 'SENT', 'ACCEPTED'),
  ('purchase_order', 'SENT', 'PARTIAL'),
  ('purchase_order', 'SENT', 'REJECTED'),
  ('purchase_order', 'SENT', 'NO_REPLY'),
  ('purchase_order', 'SENT', 'CANCELLED'),
  ('purchase_order', 'NO_REPLY', 'ACCEPTED'),
  ('purchase_order', 'NO_REPLY', 'PARTIAL'),
  ('purchase_order', 'NO_REPLY', 'REPLACED'),
  ('purchase_order', 'NO_REPLY', 'CANCELLED'),
  ('purchase_order', 'PARTIAL', 'ACCEPTED'),
  ('purchase_order', 'PARTIAL', 'REPLACED'),
  ('purchase_order', 'PARTIAL', 'CANCELLED'),
  ('purchase_order', 'ACCEPTED', 'PARTIAL'),
  ('purchase_order', 'ACCEPTED', 'RECEIVED'),
  ('purchase_order', 'ACCEPTED', 'LATE'),
  ('purchase_order', 'ACCEPTED', 'ISSUE'),
  ('purchase_order', 'ACCEPTED', 'RECEIVED_UNCONFIRMED'),
  ('purchase_order', 'ACCEPTED', 'CANCELLED'),
  ('purchase_order', 'LATE', 'RECEIVED'),
  ('purchase_order', 'LATE', 'REPLACED'),
  ('purchase_order', 'LATE', 'CANCELLED'),
  ('purchase_order', 'RECEIVED', 'ISSUE'),
  ('purchase_order', 'RECEIVED_UNCONFIRMED', 'ISSUE'),
  ('purchase_order', 'ISSUE', 'RECEIVED'),
  ('purchase_order', 'ISSUE', 'DISPUTED'),
  ('list_version', 'DRAFT', 'LOCKED'),
  ('list_version', 'DRAFT', 'DISCARDED'),
  ('list_version', 'LOCKED', 'SUPERSEDED'),
  ('shop_supplier', 'PENDING', 'LIVE'),
  ('shop_supplier', 'PENDING', 'OPTED_OUT'),
  ('shop_supplier', 'LIVE', 'OPTED_OUT'),
  ('shop', 'ONBOARDING', 'LIVE'),
  ('ops_case', 'OPEN', 'CLAIMED'),
  ('ops_case', 'OPEN', 'CLOSED'),
  ('ops_case', 'CLAIMED', 'CLOSED'),
  ('ops_case', 'CLAIMED', 'OPEN'),
  ('shop_member', 'PENDING', 'ACTIVE'),
  ('shop_member', 'PENDING', 'REMOVED'),
  ('shop_member', 'ACTIVE', 'REMOVED');

create function app.rs_guard_state() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_old text := to_jsonb(old) ->> tg_argv[1];
  v_new text := to_jsonb(new) ->> tg_argv[1];
begin
  if v_new is distinct from v_old and not exists (
    select 1 from app.state_transitions t
    where t.entity = tg_argv[0] and t.from_status = v_old and t.to_status = v_new
  ) then
    raise exception 'TL409:INVALID_TRANSITION:% from % to %', tg_argv[0], v_old, v_new;
  end if;
  return new;
end $$;

create trigger shop_order_guard before update of state on public.shop_order
  for each row execute function app.rs_guard_state('shop_order', 'state');
create trigger purchase_order_guard before update of state on public.purchase_order
  for each row execute function app.rs_guard_state('purchase_order', 'state');
create trigger list_version_guard before update of status on public.list_version
  for each row execute function app.rs_guard_state('list_version', 'status');
create trigger shop_supplier_guard before update of status on public.shop_supplier
  for each row execute function app.rs_guard_state('shop_supplier', 'status');
create trigger shop_guard before update of status on public.shop
  for each row execute function app.rs_guard_state('shop', 'status');
create trigger ops_case_guard before update of status on public.ops_case
  for each row execute function app.rs_guard_state('ops_case', 'status');
create trigger shop_member_guard before update of status on public.shop_member
  for each row execute function app.rs_guard_state('shop_member', 'status');

-- Access helpers --------------------------------------------------------------------------------

-- True for server jobs signed in with the Supabase secret key.
create function app.rs_is_system() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.role() = 'service_role', false)
$$;

create function app.rs_shop_role(p_shop uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.shop_member m
  where m.shop_id = p_shop and m.user_id = auth.uid() and m.status = 'ACTIVE' and m.active_from <= now()
$$;

create function app.rs_is_shop_member(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.rs_shop_role(p_shop) is not null
$$;

create function app.rs_sees_prices(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_member m
    where m.shop_id = p_shop and m.user_id = auth.uid() and m.status = 'ACTIVE' and m.active_from <= now()
      and (m.role = 'owner' or not m.hide_prices)
  )
$$;

create function app.rs_is_supplier_member(p_supplier uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.supplier_member m
    where m.supplier_id = p_supplier and m.user_id = auth.uid() and m.status = 'ACTIVE'
  )
$$;

create function app.rs_is_ops(p_shop uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ops_member o
    where o.user_id = auth.uid() and o.role in ('ops', 'admin')
      and (p_shop is null or o.role = 'admin' or o.assigned_shop_ids is null or p_shop = any (o.assigned_shop_ids))
  )
$$;

-- A supplier user sees a shop only through a shop_supplier link.
create function app.rs_supplier_sees_shop(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_supplier ss
    join public.supplier_member m on m.supplier_id = ss.supplier_id
    where ss.shop_id = p_shop and m.user_id = auth.uid() and m.status = 'ACTIVE'
  )
$$;

create function app.rs_shop_sees_supplier(p_supplier uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_supplier ss
    join public.shop_member m on m.shop_id = ss.shop_id
    where ss.supplier_id = p_supplier and m.user_id = auth.uid() and m.status = 'ACTIVE'
  )
$$;

-- Row level security (select only; every write goes through a function) --------------------------

alter table public.app_user enable row level security;
alter table public.device enable row level security;
alter table public.notification_pref enable row level security;
alter table public.ops_member enable row level security;
alter table public.shop enable row level security;
alter table public.outlet enable row level security;
alter table public.shop_member enable row level security;
alter table public.supplier enable row level security;
alter table public.supplier_member enable row level security;
alter table public.shop_supplier enable row level security;
alter table public.consent enable row level security;
alter table public.web_link enable row level security;
alter table public.product enable row level security;
alter table public.list_version enable row level security;
alter table public.shop_item enable row level security;
alter table public.catalogue_snapshot enable row level security;
alter table public.price_observation enable row level security;
alter table public.expected_price enable row level security;
alter table public.usage_rate enable row level security;
alter table public.learned_fact enable row level security;
alter table public.calendar_event enable row level security;
alter table public.budget enable row level security;
alter table public.shop_order enable row level security;
alter table public.shop_order_line enable row level security;
alter table public.shop_order_version enable row level security;
alter table public.purchase_order enable row level security;
alter table public.po_line enable row level security;
alter table public.supplier_reply enable row level security;
alter table public.chat_thread enable row level security;
alter table public.chat_message enable row level security;
alter table public.card_instance enable row level security;
alter table public.agent_action enable row level security;
alter table public.autonomy_setting enable row level security;
alter table public.alert enable row level security;
alter table public.notification enable row level security;
alter table public.notification_type enable row level security;
alter table public.ops_case enable row level security;
alter table public.job enable row level security;
alter table public.event enable row level security;
alter table public.app_release enable row level security;
alter table public.app_setting enable row level security;

create policy app_user_read on public.app_user for select to authenticated
  using (id = auth.uid() or app.rs_is_ops());
create policy device_read on public.device for select to authenticated using (user_id = auth.uid());
create policy notification_pref_read on public.notification_pref for select to authenticated using (user_id = auth.uid());
create policy ops_member_read on public.ops_member for select to authenticated using (user_id = auth.uid() or app.rs_is_ops());

create policy shop_read on public.shop for select to authenticated
  using (app.rs_is_shop_member(id) or app.rs_is_ops(id) or app.rs_supplier_sees_shop(id));
create policy outlet_read on public.outlet for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id));
create policy shop_member_read on public.shop_member for select to authenticated
  using (user_id = auth.uid() or app.rs_shop_role(shop_id) = 'owner' or app.rs_is_ops(shop_id));
create policy supplier_read on public.supplier for select to authenticated
  using (app.rs_is_supplier_member(id) or app.rs_shop_sees_supplier(id) or app.rs_is_ops());
create policy supplier_member_read on public.supplier_member for select to authenticated
  using (user_id = auth.uid() or app.rs_is_supplier_member(supplier_id) or app.rs_is_ops());
create policy shop_supplier_read on public.shop_supplier for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_supplier_member(supplier_id) or app.rs_is_ops(shop_id));
create policy consent_read on public.consent for select to authenticated using (user_id = auth.uid() or app.rs_is_ops());

create policy product_read on public.product for select to authenticated using (true);
create policy list_version_read on public.list_version for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id));
create policy shop_item_read on public.shop_item for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id));
create policy catalogue_snapshot_read on public.catalogue_snapshot for select to authenticated
  using (app.rs_is_supplier_member(supplier_id) or app.rs_shop_sees_supplier(supplier_id) or app.rs_is_ops());
create policy price_observation_read on public.price_observation for select to authenticated
  using (app.rs_sees_prices(shop_id) or app.rs_is_ops(shop_id));
create policy expected_price_read on public.expected_price for select to authenticated
  using (app.rs_sees_prices(shop_id) or app.rs_is_ops(shop_id));
create policy usage_rate_read on public.usage_rate for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id));
create policy learned_fact_read on public.learned_fact for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id));
create policy calendar_event_read on public.calendar_event for select to authenticated
  using (
    (shop_id is null and supplier_id is null)
    or (shop_id is not null and (app.rs_is_shop_member(shop_id) or app.rs_supplier_sees_shop(shop_id) or app.rs_is_ops(shop_id)))
    or (supplier_id is not null and (app.rs_is_supplier_member(supplier_id) or app.rs_shop_sees_supplier(supplier_id) or app.rs_is_ops()))
  );
create policy budget_read on public.budget for select to authenticated
  using (app.rs_sees_prices(shop_id) or app.rs_is_ops(shop_id));

create policy shop_order_read on public.shop_order for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id));
create policy shop_order_line_read on public.shop_order_line for select to authenticated
  using (exists (select 1 from public.shop_order o where o.id = order_id and (app.rs_is_shop_member(o.shop_id) or app.rs_is_ops(o.shop_id))));
create policy shop_order_version_read on public.shop_order_version for select to authenticated
  using (exists (select 1 from public.shop_order o where o.id = order_id and (app.rs_is_shop_member(o.shop_id) or app.rs_is_ops(o.shop_id))));
-- A supplier sees a PO only once it has been sent.
create policy purchase_order_read on public.purchase_order for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id)
         or (sent_at is not null and app.rs_is_supplier_member(supplier_id)));
create policy po_line_read on public.po_line for select to authenticated
  using (exists (
    select 1 from public.purchase_order p where p.id = po_id
      and (app.rs_is_shop_member(p.shop_id) or app.rs_is_ops(p.shop_id)
           or (p.sent_at is not null and app.rs_is_supplier_member(p.supplier_id)))));
create policy supplier_reply_read on public.supplier_reply for select to authenticated
  using (exists (
    select 1 from public.purchase_order p where p.id = po_id
      and (app.rs_is_shop_member(p.shop_id) or app.rs_is_ops(p.shop_id) or app.rs_is_supplier_member(p.supplier_id))));

create policy chat_thread_read on public.chat_thread for select to authenticated
  using (
    (kind in ('shop', 'support') and (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id)))
    or (kind = 'supplier' and (app.rs_is_supplier_member(supplier_id) or app.rs_is_ops()))
    or (kind = 'ops_onboarding' and app.rs_is_ops(shop_id))
  );
create policy chat_message_read on public.chat_message for select to authenticated
  using (exists (
    select 1 from public.chat_thread t where t.id = thread_id and (
      (t.kind in ('shop', 'support') and (app.rs_is_shop_member(t.shop_id) or app.rs_is_ops(t.shop_id)))
      or (t.kind = 'supplier' and (app.rs_is_supplier_member(t.supplier_id) or app.rs_is_ops()))
      or (t.kind = 'ops_onboarding' and app.rs_is_ops(t.shop_id)))));
create policy card_instance_read on public.card_instance for select to authenticated
  using (
    (audience = 'shop' and (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id)))
    or (audience = 'supplier' and (app.rs_is_supplier_member(supplier_id) or app.rs_is_ops()))
    or (audience = 'ops' and app.rs_is_ops(shop_id))
  );
create policy agent_action_read on public.agent_action for select to authenticated
  using ((shop_id is not null and (app.rs_shop_role(shop_id) = 'owner' or app.rs_is_ops(shop_id))) or app.rs_is_ops());
create policy autonomy_setting_read on public.autonomy_setting for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id));
create policy alert_read on public.alert for select to authenticated
  using (app.rs_is_shop_member(shop_id) or app.rs_is_ops(shop_id));
create policy notification_read on public.notification for select to authenticated using (user_id = auth.uid());
create policy notification_type_read on public.notification_type for select to authenticated using (true);
create policy ops_case_read on public.ops_case for select to authenticated using (app.rs_is_ops(shop_id));
create policy event_read on public.event for select to authenticated using (app.rs_is_ops());
create policy app_release_read on public.app_release for select to anon, authenticated using (true);
create policy app_setting_read on public.app_setting for select to authenticated using (true);
-- job and web_link have no policies: only server jobs (secret key) and functions touch them.

-- Live updates for chat and cards.
alter publication supabase_realtime add table public.chat_message, public.card_instance;
