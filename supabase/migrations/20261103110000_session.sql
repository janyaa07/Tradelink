-- The signed-in user's identity for the app shell and the request proxy.
create function public.whoami() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'userId', p.user_id,
    'fullName', p.full_name,
    'email', p.email,
    'theme', p.theme,
    'orgId', o.id,
    'orgName', o.name,
    'orgStatus', o.status,
    'kind', o.kind
  )
  from public.profiles p
  join public.memberships m on m.user_id = p.user_id
  join public.organisations o on o.id = m.organisation_id
  where p.user_id = auth.uid()
$$;

revoke execute on function public.whoami() from public, anon;
grant execute on function public.whoami() to authenticated;
