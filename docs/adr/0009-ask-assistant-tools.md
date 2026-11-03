# ADR 0009: Ask assistant with read-only, organisation-scoped tools

Status: Proposed

## Context
Ask answers questions about prices, deliveries, spending and suppliers, and can prepare an order for review. It must see only the signed-in buyer's data.

## Decision
- The SDK tool runner (`client.beta.messages.toolRunner` with `betaZodTool`) drives the loop. A turn can make at most 6 tool calls.
- Tools are read-only and take no organisation ID as input. Each one queries Supabase with the user's own session, so RLS scopes every query to the user's organisation. The tools are `find_products`, `get_order`, `list_orders`, `get_spend`, `get_reorder_plan`, `get_usual_items`, `get_supplier_record` and `prepare_order_draft`. The last one only returns a parsed draft to show; it saves nothing.
- Responses stream to the browser through a Route Handler as server-sent events. The app renders cards for orders, prices and drafts from typed tool results, never from HTML the model writes.
- "Review order" moves the draft into the buyer's order review. Nothing is sent until the buyer confirms there.
- Each user's conversation is kept for 90 days.

## Alternatives considered
- Giving the model SQL access. Rejected: too broad and hard to constrain.
- Managed Agents. Rejected: the tools need the user's session and our database, which live in our app. A hosted sandbox adds nothing here.

## Consequences
Tests mock the SDK. They check that each tool returns only the caller's data and that tool inputs are validated before use.
