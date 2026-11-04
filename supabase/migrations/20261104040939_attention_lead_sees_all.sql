-- The operations lead sees and assigns the whole attention queue; other operators see only what is assigned to them.

alter table public.admin_profiles add column is_lead boolean not null default false;
comment on column public.admin_profiles.is_lead is 'The operations lead sees every attention item and assigns them; other operators see only their own.';

-- Hannah Lim leads operations in the demo data.
update public.admin_profiles set is_lead = true where user_id = '00000000-0000-4000-9000-0000000000a1';

create function app.is_admin_lead() returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_admin() and exists (
    select 1 from public.admin_profiles ap where ap.user_id = auth.uid() and ap.is_lead
  )
$$;
revoke all on function app.is_admin_lead() from public;
grant execute on function app.is_admin_lead() to authenticated;

create or replace view public.v_attention with (security_invoker = true) as
with causes as (
  select 'invite:' || s.id as item_key, 'medium'::text as priority, 'Supplier invitation'::text as type,
    s.name || ' has not joined' as title,
    'Invited by ' || coalesce(b.name, 'a buyer') || ' more than 24 hours ago.' as detail,
    s.id as org_id, s.created_at
  from public.organisations s
  left join public.organisations b on b.id = s.invited_by_org_id
  where s.kind = 'supplier' and s.status = 'invited' and s.created_at < now() - interval '24 hours'
  union all
  select 'dispute:' || i.id, 'high', 'Dispute', 'ISS-' || i.number || ' disputed',
    sup.name || ' disputed a ' || replace(i.type, '_', ' ') || ' report on ORD-' || o.number || ' from ' || buy.name || '.',
    i.supplier_org_id, coalesce(i.answered_at, i.created_at)
  from public.issues i
  join public.orders o on o.id = i.order_id
  join public.organisations sup on sup.id = i.supplier_org_id
  join public.organisations buy on buy.id = i.buyer_org_id
  where i.status = 'disputed'
  union all
  select 'issue:' || i.id, 'medium', 'Delivery problem', 'ISS-' || i.number || ' open for more than 4 hours',
    buy.name || ' reported ' || replace(i.type, '_', ' ') || ' on ORD-' || o.number || '. ' || sup.name || ' has not answered.',
    i.supplier_org_id, i.created_at
  from public.issues i
  join public.orders o on o.id = i.order_id
  join public.organisations sup on sup.id = i.supplier_org_id
  join public.organisations buy on buy.id = i.buyer_org_id
  where i.status = 'open' and i.created_at < now() - interval '4 hours'
  union all
  select 'stock-out:' || p.id, 'high', 'Stock', p.name || ' is out of stock', s.name || ' has none available to order.',
    p.supplier_org_id, inv.updated_at
  from public.products p
  join public.inventory_levels inv on inv.product_id = p.id
  join public.organisations s on s.id = p.supplier_org_id
  where p.status = 'active' and s.status = 'active' and inv.on_hand - inv.reserved <= 0
  union all
  select 'order:' || o.id, 'medium', 'Order', 'ORD-' || o.number || ' waiting for ' || s.name,
    b.name || ' placed it more than 30 minutes ago.', o.supplier_org_id, o.created_at
  from public.orders o
  join public.organisations s on s.id = o.supplier_org_id
  join public.organisations b on b.id = o.buyer_org_id
  where o.status = 'pending' and s.status = 'active' and o.created_at < now() - interval '30 minutes'
  union all
  select 'catalogue:' || p.id, 'medium', 'Catalogue', p.name || ' not confirmed',
    'Added by ' || b.name || '. ' || s.name || ' has not confirmed the price and stock.', p.supplier_org_id, p.created_at
  from public.products p
  join public.organisations s on s.id = p.supplier_org_id
  join public.organisations b on b.id = p.added_by_org_id
  where p.status = 'unconfirmed' and s.status = 'active' and b.kind = 'buyer'
  union all
  select 'stock-low:' || p.id, 'medium', 'Stock', p.name || ' is running low',
    s.name || ' has ' || (inv.on_hand - inv.reserved) || ' available, reorder level ' || p.reorder_level || '.',
    p.supplier_org_id, inv.updated_at
  from public.products p
  join public.inventory_levels inv on inv.product_id = p.id
  join public.organisations s on s.id = p.supplier_org_id
  where p.status = 'active' and s.status = 'active' and inv.on_hand - inv.reserved > 0 and inv.on_hand - inv.reserved <= p.reorder_level
  union all
  select 'audit:' || a.id, 'medium', 'Security', 'Blocked action',
    coalesce(a.actor_name, 'Unknown user') || ' (' || coalesce(a.actor_org_name, 'no organisation') || '): ' || a.action,
    a.actor_org_id, a.at
  from public.audit_log a
  where a.outcome = 'denied'
)
select c.item_key, c.priority, c.type, c.title, c.detail, c.org_id, c.created_at, st.assigned_user_id
from causes c
left join public.attention_states st on st.item_key = c.item_key
where app.is_admin()
  and (st.handled_at is null or st.handled_at < c.created_at)
  and (app.is_admin_lead() or st.assigned_user_id = (select auth.uid()));

-- Only the lead assigns. A null user clears the assignment.
create or replace function public.assign_attention(p_item text, p_user uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me record;
begin
  select * into v_me from app.require_kind('platform');
  if not app.is_admin_lead() then
    raise exception 'TL403:FORBIDDEN:only the operations lead can assign attention items';
  end if;
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

-- The lead can mark any item handled; other operators only the items assigned to them.
create or replace function public.mark_attention_handled(p_item text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me record;
begin
  select * into v_me from app.require_kind('platform');
  if p_item is null or length(p_item) not between 1 and 200 then
    raise exception 'TL400:INVALID_INPUT:item key must be 1 to 200 characters';
  end if;
  if not app.is_admin_lead() and not exists (
    select 1 from public.attention_states st where st.item_key = p_item and st.assigned_user_id = v_me.user_id
  ) then
    raise exception 'TL403:FORBIDDEN:only the operations lead or the assigned operator can mark this item handled';
  end if;

  insert into public.attention_states (item_key, handled_at, handled_by) values (p_item, now(), v_me.user_id)
  on conflict (item_key) do update set handled_at = excluded.handled_at, handled_by = excluded.handled_by;

  perform app.audit('Marked attention item ' || p_item || ' handled');
  return jsonb_build_object('itemKey', p_item, 'handledAt', now());
end $$;
