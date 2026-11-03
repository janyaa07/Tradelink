-- Cards (M0): Undo on an agent action notice. Pending: the parent applies it and renames the file
-- to the version Supabase records.
--
-- The owner's tap on Undo marks the agent action undone while its undo window is open. Reversing the
-- action's effect (for example switching a line back) comes with the agents that make those actions
-- (M4); the agent_action guard allows undone_at to be set once.

create function public.rs_undo_agent_action(p_action uuid, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_done jsonb := app.rs_idem_get('rs_undo_agent_action', p_key);
  v_action public.agent_action;
begin
  if v_done is not null then
    return v_done;
  end if;
  if app.rs_is_system() or auth.uid() is null then
    raise exception 'TL403:FORBIDDEN:only the shop owner can undo this';
  end if;
  select * into v_action from public.agent_action a where a.id = p_action for update;
  if not found or v_action.shop_id is null or app.rs_shop_role(v_action.shop_id) is distinct from 'owner' then
    raise exception 'TL404:NOT_FOUND:agent action %', p_action;
  end if;
  if v_action.undone_at is not null then
    return app.rs_idem_put('rs_undo_agent_action', p_key,
      jsonb_build_object('action_id', v_action.id, 'undone_at', v_action.undone_at, 'already', true));
  end if;
  if v_action.undo_until is null or v_action.undo_until <= now() then
    raise exception 'TL409:UNDO_EXPIRED:the undo window for this action has closed';
  end if;

  update public.agent_action a set undone_at = now() where a.id = v_action.id
  returning * into v_action;
  perform app.rs_event('agent_action.undone', v_action.shop_id, v_action.supplier_id, 'agent_action', v_action.id,
    jsonb_build_object('agent', v_action.agent, 'action', v_action.action));
  return app.rs_idem_put('rs_undo_agent_action', p_key,
    jsonb_build_object('action_id', v_action.id, 'undone_at', v_action.undone_at, 'already', false));
end $$;

revoke all on function public.rs_undo_agent_action(uuid, uuid) from public, anon;
grant execute on function public.rs_undo_agent_action(uuid, uuid) to authenticated, service_role;
