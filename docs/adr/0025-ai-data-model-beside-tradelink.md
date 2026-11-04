# ADR 0025: The Tradelink AI data model is built beside the Tradelink tables

Status: Accepted (3 November 2026). Owner decision: replace the demo schema with the Tradelink AI model (`docs/AI_DESIGN.md`, section 9.1).

## Context
Tradelink AI replaces Tradelink's shapes:
- supplier-owned catalogues and stock become per-shop locked item lists;
- per-supplier orders become a shop order plus versioned purchase orders;
- organisations become shops, outlets and shared supplier records.

The live app at tradelink-nine.vercel.app still runs on the Tradelink tables, and each milestone replaces only part of it.

## Decision
- **Separate tables.** The Tradelink AI tables are added in new migrations (`20261103131105_ai_core_schema`, `20261103131531_ai_core_functions`) with their own names. Reserved words are avoided: `shop_order`, `shop_order_line`, `ops_case`. The Tradelink tables stay untouched until the slice that replaces them, then they are dropped in a later migration.
- **Kept from Tradelink:**
  - `app.state_transitions` and the guard pattern. Tradelink AI entities use `app.rs_guard_state(entity, column)`.
  - `idempotency_keys` (the idempotency owner is the user, or a fixed id for server jobs).
  - `app.forbid_change` for append-only tables.
  - The `TLnnn:REASON:detail` error format.
- **Agent output is written only with the server's secret key** (`app.rs_is_system()`), and signed-in users cannot call those functions at all (`20261103132225_ai_server_only_grants`). This covers cards, agent messages, the agent log and jobs.
- **Person-only actions.** A pick, an edit and Confirm can only be made by a signed-in person (owner or active staff), never by the server, so the agent cannot pick items or confirm orders for the owner.
- **Versions on orders.** Every change to a shop order makes a new version, and the version as it stood is kept in `shop_order_version` (append-only). Functions that act on an order take `p_version` and raise `TL409:STALE_VERSION` when it is not the latest (EC08).
- **Tradelink AI users get their own area.** People without a Tradelink organisation are routed to `/r`, and RLS decides what they see.

## Consequences
- Two models live side by side for a few milestones. Each slice's migration removes what it replaces.
- Demo data for Tradelink AI lives in `supabase/tradelink-ai-mock-data.sql`. Phone sign-in arrives in M1; until then demo users sign in with email and password.
- The server needs `SUPABASE_SECRET_KEY` (server only) for any agent output and for jobs.
