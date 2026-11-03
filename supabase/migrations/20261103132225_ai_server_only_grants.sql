-- Defence in depth: server-only functions already refuse callers without the secret key
-- (app.rs_require_system); signed-in users now cannot call them through the API at all.
revoke execute on function public.rs_agent_message(uuid, text, uuid, uuid) from authenticated;
revoke execute on function public.rs_put_card(jsonb, boolean) from authenticated;
revoke execute on function public.rs_set_card_state(uuid, text, jsonb) from authenticated;
revoke execute on function public.rs_log_agent_action(jsonb) from authenticated;
revoke execute on function public.rs_job_enqueue(text, timestamptz, text, jsonb) from authenticated;
revoke execute on function public.rs_job_cancel(text) from authenticated;
revoke execute on function public.rs_job_claim(int) from authenticated;
revoke execute on function public.rs_job_finish(uuid, boolean, text) from authenticated;
