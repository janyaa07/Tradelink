-- A buyer or supplier can always read products that appear on their own orders, even after a
-- product is hidden or a supplier is suspended. The catalogue view still applies the stricter rule.
create function app.product_on_my_orders(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.order_lines l join public.orders o on o.id = l.order_id
    where l.product_id = p_product
      and (o.buyer_org_id = app.my_org_id() or o.supplier_org_id = app.my_org_id())
  )
$$;
grant execute on function app.product_on_my_orders(uuid) to authenticated;

drop policy products_read on public.products;
create policy products_read on public.products for select to authenticated
  using (app.can_see_product(id) or app.product_on_my_orders(id));

create or replace view public.v_catalogue with (security_invoker = true) as
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
where p.status <> 'hidden' and app.can_see_product(p.id);
