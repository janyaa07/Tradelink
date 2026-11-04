# Database function contract

The write path for the app (ADR 0004). Every function:
- lives in `public` (so the Supabase client can call it with `supabase.rpc`);
- is `security definer` with `set search_path = ''`;
- is executable by `authenticated` only;
- returns `jsonb`.

Each function checks the caller from `auth.uid()` and its organisation (`app.my_org_id()`, `app.my_org_kind()`, `app.is_admin()`). It checks the state transition, locks rows with `for update` (products in ascending ID order), writes the stock history, audit log and notifications in the same transaction, and returns.

## Errors

Raise `exception '<code>:<reason>:<detail>'`. The app maps the code and reason to user copy.

| Code | Reasons |
| --- | --- |
| `TL400` | `INVALID_INPUT` |
| `TL401` | `NOT_SIGNED_IN` |
| `TL403` | `NOT_ALLOWED` |
| `TL404` | `NOT_FOUND` |
| `TL409` | `STOCK_SHORT`, `INVALID_TRANSITION`, `DUPLICATE`, `STALE_DRAFT`, `CONFIRM_STOCK_FIRST`, `ALREADY_REPORTED`, `BELOW_RESERVED` |
| `TL429` | `RATE_LIMITED` |

`STOCK_SHORT` detail is JSON: `[{"productId":"…","available":3}]`.

## Idempotency

Functions marked (I) take `p_key uuid`. If `(auth.uid(), function name, p_key)` already exists in `idempotency_keys`, the function returns the stored result and changes nothing.

## Audit and notifications

Audit action text follows the prototype, for example "Placed ORD-1044", "Accepted ORD-1041", "Marked ORD-1040 out for delivery", "Received 30 of DG-1001" and "Changed price of DG-1010 to S$9.40". `related_org_ids` holds both organisations involved.

| Event | Notification goes to |
| --- | --- |
| Order placed | Supplier |
| Order accepted, part accepted, rejected, out for delivery or delivered | Buyer |
| Order cancelled | Supplier |
| Issue reported | Supplier |
| Issue answered | Buyer |
| Issue disputed | Platform, with kind "Dispute opened" |
| Supplier suspended or reactivated | Supplier and its connected buyers |

## Buyer functions

| Function | Behaviour |
| --- | --- |
| `save_draft(p_lines jsonb, p_version int)` | Replaces the caller's draft. Lines: `[{id, sourceText, productId \| null, qty, kg \| null, qtyAssumed, options: uuid[], state}]`, at most 60. Every non-null `productId` must pass `app.can_see_product`. Version mismatch raises `STALE_DRAFT`. Returns `{version}`. |
| `place_orders(p_lines jsonb, p_draft_version int, p_key uuid)` (I) | `p_lines`: `[{productId, qty, sourceText}]`. Merges duplicate products. Checks visibility, open supplier and connection. Locks inventory and checks availability for `active` products. On a shortfall, raises `STOCK_SHORT` with detail and changes nothing. Creates one `pending` order per supplier, with `unit_price` copied from the product and `held = (status = 'active')`, and reserves held lines (stock history `reserved`). Writes order events, sets `usual_items.last_paid`, clears the draft lines (version + 1) unless `p_draft_version` is null (a direct order from Tradelink AI leaves the cart alone), and writes audit and notifications. Returns `{orders: [{id, number, supplierName}]}`. |
| `cancel_order(p_order uuid, p_key uuid)` (I) | Own buyer. `pending` to `cancelled`. Releases held lines. |
| `confirm_all_here(p_order, p_key)` (I) | Own buyer. If `out_for_delivery`, delivers first (as `mark_delivered`). Requires `delivered` and `unchecked`. Sets `all_here`. Adds quantities to `usual_items.in_shop` for items in usuals. |
| `report_problem(p_order, p_product, p_type text, p_qty int, p_note text, p_key)` (I) | Type is `short`, `damaged`, `wrong_item` or `expired`. Quantity 1 to the line quantity. Delivers first if out for delivery. Requires delivered and unchecked. Sets `problem`. Creates an issue with amount = qty × `unit_price`. Adds (line qty − qty) to `in_shop`. |
| `report_not_here(p_order, p_key)` (I) | `out_for_delivery` only. Creates a `late` issue. A second open one raises `ALREADY_REPORTED`. |
| `mark_issue_seen(p_issue uuid)` | Own buyer. Sets `buyer_seen = true`. |
| `mark_credit_received(p_issue, p_key)` (I) | `credit_promised` to `credit_received`. |
| `buyer_add_product(p_name text, p_unit text, p_price numeric, p_supplier uuid, p_key)` (I) | The supplier must be connected and open. Creates an `unconfirmed` product: SKU `NEW-<n>`, `added_by_org_id` = buyer, inventory 0, art and category guessed from the name as in the prototype `kindOf`. Notifies the supplier. Returns `{productId}`. Duplicate name for that supplier raises `DUPLICATE`. |
| `buyer_add_supplier(p_name text, p_contact text, p_phone text, p_key)` (I) | Creates a supplier organisation with status `invited` (`invited_by_org_id` = buyer), its supplier profile and an `invited` connection to the buyer, so the buyer can add products for it straight away. Name 2 to 120 characters; phone optional, 8 to 16 digits. A supplier with the same name raises `DUPLICATE` with detail `connected` (already the buyer's) or `listed`. Returns `{supplierId, name}`. |
| `set_usual_item(p_product, p_usual_qty int, p_use_per_day numeric, p_in_shop numeric)` | Upsert. |
| `remove_usual_item(p_product)` | Removes the usual item. |
| `skip_restock_today(p_products uuid[])` | Inserts `restock_skips` for today's Asia/Singapore date. |
| `ack_price_change(p_change uuid)` | Records the acknowledgement. |
| `resolve_partial(p_partial uuid, p_choice text)` | Choice is `added` or `skipped`. |
| `update_buyer_settings(p_budget numeric, p_suggest boolean, p_price_alerts boolean, p_budget_warning boolean)` | Updates the buyer's settings. |

## Supplier functions

| Function | Behaviour |
| --- | --- |
| `accept_order(p_order, p_date date, p_key)` (I) | Own supplier. `pending` to `accepted`. The date must be today or later (Asia/Singapore), stored as `confirmed_delivery_date`. Unheld lines whose product is still `unconfirmed` raise `CONFIRM_STOCK_FIRST`. Unheld lines with an active product are reserved now, set `held = true` and take the current price. |
| `part_accept_order(p_order, p_lines jsonb, p_date, p_later_date date, p_key)` (I) | `p_lines`: `[{productId, sendQty}]`, 0 to qty. Without `p_later_date` (the four-argument form calls this with null): all zero means reject; otherwise reduces quantities, releases the difference, deletes zero lines, inserts `partial_fulfilments` for reduced lines, then accepts as above. With `p_later_date` (after `p_date`): something must go now; the rest stays on each line as `later_qty` (not reserved) and the order gets `later_delivery_date` and `later_status = 'waiting'`, so it comes in two deliveries. The buyer's alert lists what is not coming, or what comes later, and the new total. |
| `mark_rest_out_for_delivery(p_order, p_key)` (I) | The rest of a two-delivery order: `later_status` `waiting` to `out_for_delivery`. Tells the buyer. |
| `deliver_rest(p_order, p_key)` (I) | `later_status` `waiting` or `out_for_delivery` to `delivered`, while the order is accepted, out for delivery or delivered. Needs free stock for every `later_qty` (else `TL409:REST_NOT_IN_STOCK`); each line writes a stock history `delivered` row (on hand −later_qty, reserved 0), `later_qty` moves into `qty`, and `check_status` returns to `unchecked` so the buyer checks again. |
| `reject_order(p_order, p_key)` (I) | `pending` to `rejected`. Releases held lines. |
| `mark_out_for_delivery(p_order, p_key)` (I) | `accepted` to `out_for_delivery`. |
| `mark_delivered(p_order, p_key)` (I) | `out_for_delivery` to `delivered`. Sets `delivered_at`. Each held line writes a stock history `delivered` row (on hand −qty, reserved −qty). |
| `answer_issue(p_issue, p_answer text, p_key)` (I) | Answer is `credit` (amount > 0), `replace` (not late or invoice), `on_the_way` (late only, to `supplier_replied`) or `dispute`. Issue must be open and own. Sets `buyer_seen = false` and `answered_at`. |
| `supplier_add_product(p_name, p_unit, p_price, p_opening int, p_reorder int, p_category text, p_art text, p_key)` (I) | SKU is a prefix from the supplier's initials, a dash and the next number. Opening stock is written to the stock history as `received` with reason `opening_stock` when above 0. |
| `receive_stock(p_product, p_qty int, p_key)` (I) | Quantity 1 to 9999. If the product is `unconfirmed`, it becomes `active` and gets reorder level 5 when it was 0. |
| `confirm_product_stock(p_product, p_qty, p_price, p_reorder, p_key)` (I) | For an unconfirmed product: becomes `active` with the given price and reorder level, and receives the quantity. |
| `change_price(p_product, p_price numeric, p_key)` (I) | Inserts into `price_changes` when the price differs. |
| `adjust_stock(p_product, p_change int, p_reason text, p_note text, p_key)` (I) | Change from −9999 to 9999, not 0. On hand + change must be at least reserved, otherwise `BELOW_RESERVED`. Writes an `adjusted` stock history row. |
| `update_business_profile(p_contact, p_phone, p_email, p_address, p_range, p_days smallint[], p_lead int, p_cutoff time, p_minimum numeric)` | Updates the supplier's business profile. |

## Order requests and messages (buyer or supplier on the order)

Stored in `order_requests` (read through the order's RLS). A delivery date only moves when the other side agrees.

| Function | Rules |
| --- | --- |
| `propose_delivery_date(p_order, p_part text, p_date, p_note text, p_key)` (I) | `p_part` is `first` (order pending or accepted) or `rest` (`later_status = 'waiting'`, date after the first delivery). Date today or later and different from now; note up to 500 characters. Replaces an open request for the same part (`withdrawn`). Tells the other side. |
| `answer_delivery_date(p_request, p_accept boolean, p_note text, p_key)` (I) | Only the other side, only while `open`. Accepting moves `requested_delivery_date` (pending), `confirmed_delivery_date` (accepted) or `later_delivery_date` (rest). Tells the side that asked. |
| `send_order_message(p_order, p_body text, p_key)` (I) | 1 to 500 characters, 30 an hour per person (`TL429:RATE_LIMITED`). Tells the other side with the first 170 characters. |
| `cancel_rest(p_order, p_key)` (I) | Either side, while `later_status = 'waiting'`. Clears `later_qty`, removes lines with nothing left, withdraws open date requests for the rest. Tells the other side. |

## Admin functions (`app.is_admin()`)

| Function | Behaviour |
| --- | --- |
| `set_supplier_status(p_org, p_status text, p_key)` (I) | `active` to `suspended` cancels the supplier's pending orders, releasing stock and notifying buyers. `suspended` to `active` reactivates it. |
| `resolve_dispute(p_issue, p_outcome text, p_key)` (I) | Outcome `credit` moves `disputed` to `credit_promised`; `close` moves it to `closed`. Sets `buyer_seen = false`. |
| `assign_attention(p_item text, p_user uuid)` | Upserts `attention_states.assigned_user_id`; a null user clears it. |
| `mark_attention_handled(p_item text)` | Sets `handled_at` and `handled_by`. |

## Functions for every role

| Function | Behaviour |
| --- | --- |
| `mark_notifications_read(p_ids uuid[] default null)` | Marks the given notifications read, or all of them when null. |
| `set_theme(p_theme text)` | Saves the theme on the profile. |
| `touch_last_seen()` | Updates `profiles.last_seen_at`. |
| `log_denied(p_action text)` | Inserts an audit row with outcome `denied`, using the caller's identity. |
| `record_ai_usage(p_feature, p_model, p_input int, p_output int, p_latency int, p_outcome, p_lines_read int, p_lines_matched int)` | Records one AI call. |
| `hit_rate_limit(p_action text, p_limit int, p_window_seconds int)` | Returns `boolean`: true when allowed. Fixed window per `auth.uid()` and action. |

## Read models

| View | Contents |
| --- | --- |
| `v_catalogue` | Already exists. |
| `v_order_totals` | Already exists. |
| `v_attention` | Admins only (`where app.is_admin()`): `item_key, priority ('high' or 'medium'), type, title, detail, org_id, created_at, assigned_user_id`, built from the ten rules in DISCOVERY 6.6 that apply tonight (no invoices or service checks). Excludes keys handled after the cause was created. |
