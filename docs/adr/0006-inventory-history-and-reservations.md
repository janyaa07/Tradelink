# ADR 0006: Inventory history and stock reservations

Status: Proposed

## Context
Available stock is on hand minus reserved. Concurrent orders must not oversell, and every stock change must be recorded.

## Decision
- `inventory_levels(product_id, on_hand, reserved)` holds the current balances, with the constraints `on_hand >= 0`, `reserved >= 0` and `reserved <= on_hand`.
- `stock_movements` is an append-only stock history. Its types are `received`, `reserved`, `released`, `delivered` and `adjusted`; an adjustment carries a reason: damaged, expired or count correction. Each row records the change to on hand and to reserved, the balances after the change, the order or user that caused it, and the time.
- Balances change only inside database functions that also write the stock history row. A pgTAP test checks that replaying the stock history gives every current balance.
- Reserving stock locks the `inventory_levels` rows with `select ... for update`, in ascending product ID order so two orders cannot deadlock. It then checks availability again. If any product is short, the whole checkout fails and lists the products that are short.
- When a buyer adds a product the supplier has not confirmed yet, its stock is not held. Stock is reserved when the supplier confirms the product and accepts the order.
- An adjustment that would leave on hand below reserved is rejected with "This leaves less stock than is reserved for open orders."

## Alternatives considered
- Calculating balances from the stock history on every read. Rejected: slower, and harder to lock.
- Optimistic concurrency with version numbers. Rejected: row locks are simpler, and contention is low.

## Consequences
Concurrency tests run many checkouts at once against a local database, and check there is no oversell and the stock history stays consistent.
