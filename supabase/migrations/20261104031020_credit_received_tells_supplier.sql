-- When the buyer confirms a promised credit has reached them, the supplier is told and the problem closes.
create or replace function public.mark_credit_received(p_issue uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me record;
  v_prev jsonb;
  v_issue public.issues;
  v_ref text;
  v_iss text;
begin
  select * into v_me from app.require_kind('buyer');
  v_prev := app.idem_get('mark_credit_received', p_key);
  if v_prev is not null then
    return v_prev;
  end if;

  v_issue := app.lock_issue(p_issue, v_me.org_id);
  v_iss := 'ISS-' || v_issue.number;
  perform app.assert_transition('issue', v_issue.status, 'credit_received', v_iss);
  update public.issues set status = 'credit_received' where id = v_issue.id;
  select app.order_ref(o.number) into v_ref from public.orders o where o.id = v_issue.order_id;

  perform app.audit('Recorded credit received on ' || v_ref,
    array[v_issue.supplier_org_id], jsonb_build_object('issueId', v_issue.id, 'amount', v_issue.amount));
  perform app.notify(v_issue.supplier_org_id, 'Credit received', v_iss || ': credit confirmed',
    v_me.org_name || ' confirmed your ' || app.money(v_issue.amount) || ' credit for ' || v_iss || ' on ' || v_ref
      || ' has reached them. The problem is closed.',
    '/issues/' || v_issue.id, v_me.org_id);

  return app.idem_put('mark_credit_received', p_key, jsonb_build_object('id', v_issue.id, 'status', 'credit_received'));
end $$;
