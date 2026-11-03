-- Owner decision (3 November 2026): two-factor sign-in is removed for now, and buyers and
-- suppliers can create their own accounts. This supersedes decisions D2 and D9.

-- 1. Admin access no longer requires a two-factor (aal2) session.
create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_org_kind() = 'platform', false)
$$;

-- 2. A new sign-up becomes a buyer or supplier business. The business details come from the
-- sign-up metadata; the kind may only be buyer or supplier, never platform (admin). Users
-- created without that metadata (seeded users) are left alone.
create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text := new.raw_user_meta_data ->> 'tl_kind';
  v_business text := btrim(coalesce(new.raw_user_meta_data ->> 'tl_business_name', ''));
  v_contact text := btrim(coalesce(new.raw_user_meta_data ->> 'tl_full_name', ''));
  v_phone text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'tl_phone', '')), '');
  v_org uuid;
begin
  if v_kind is null then
    return new;
  end if;
  if v_kind not in ('buyer', 'supplier') then
    raise exception 'TL400:INVALID_INPUT:account type must be buyer or supplier';
  end if;
  if length(v_business) < 2 or length(v_business) > 120 or length(v_contact) < 2 or length(v_contact) > 120 then
    raise exception 'TL400:INVALID_INPUT:business name and full name are required';
  end if;
  if exists (select 1 from public.organisations o where o.kind = v_kind and lower(o.name) = lower(v_business)) then
    raise exception 'TL409:DUPLICATE:a business with this name already exists';
  end if;

  insert into public.organisations (kind, name, status, contact_name, phone, email, joined_at)
  values (v_kind, v_business, 'active', v_contact, v_phone, new.email, now())
  returning id into v_org;

  insert into public.profiles (user_id, full_name, phone, email) values (new.id, v_contact, v_phone, new.email);
  insert into public.memberships (user_id, organisation_id) values (new.id, v_org);

  if v_kind = 'buyer' then
    insert into public.buyer_settings (organisation_id) values (v_org);
    -- Connect to every active supplier so a new buyer can order straight away.
    insert into public.trading_connections (buyer_org_id, supplier_org_id, status)
    select v_org, s.id, 'active' from public.organisations s where s.kind = 'supplier' and s.status = 'active';
  else
    insert into public.supplier_profiles (organisation_id) values (v_org);
    -- Connect to every active buyer so a new supplier's products can be ordered.
    insert into public.trading_connections (buyer_org_id, supplier_org_id, status)
    select b.id, v_org, 'active' from public.organisations b where b.kind = 'buyer' and b.status = 'active';
  end if;

  insert into public.audit_log (actor_user_id, actor_name, actor_org_id, actor_org_name, actor_role, action, related_org_ids)
  values (new.id, v_contact, v_org, v_business, v_kind, 'Created a ' || v_kind || ' account', array[v_org]);

  insert into public.notifications (recipient_org_id, kind, title, body, link, subject_org_id)
  select p.id, 'New account', 'New ' || v_kind || ' account',
         v_business || ' created a ' || v_kind || ' account.', '/' || v_kind || 's/' || v_org, v_org
  from public.organisations p where p.kind = 'platform';

  return new;
end $$;

revoke execute on function app.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();
