-- AUTH-04 and ADR 0011: admin access requires a two-factor (aal2) session. Every admin RLS
-- policy and admin database function goes through app.is_admin(), so this one change applies
-- everywhere: an admin signed in with a password only can read and change nothing admin-only.
create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_org_kind() = 'platform', false)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;
