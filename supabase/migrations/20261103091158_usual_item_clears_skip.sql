-- BUY-46.3: editing "In your shop" recalculates Ready for tomorrow, so today's "Not today" skip is cleared.
create function app.clear_restock_skip() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.in_shop is distinct from old.in_shop then
    delete from public.restock_skips
    where buyer_org_id = new.buyer_org_id
      and product_id = new.product_id
      and skip_date = (now() at time zone 'Asia/Singapore')::date;
  end if;
  return new;
end $$;

revoke execute on function app.clear_restock_skip() from public, anon, authenticated;

create trigger usual_items_clear_skip after update of in_shop on public.usual_items
  for each row execute function app.clear_restock_skip();
