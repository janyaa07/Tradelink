# ADR 0005: Organisation tenancy and trading connections

Status: Proposed

## Context
Each buyer and supplier organisation must be fully isolated. Decision D1 says buyers see only suppliers they are connected to. Decision D10 says an organisation can have several users with equal rights. Decision D3 says admins and operators are the same role.

## Decision
- Each organisation has a `kind`: `buyer`, `supplier` or `platform`. A user's role comes from the kind of organisation they belong to. There is one `platform` organisation, Tradelink Operations, and its members are the admins.
- `memberships(user_id, organisation_id)` links users to organisations. A user belongs to exactly one organisation, and all members have equal rights within their role.
- `trading_connections(buyer_org_id, supplier_org_id, status)` has the statuses `invited`, `active`, `declined` and `ended`. A connection is created when a buyer adds a new supplier (with an invitation) or links an existing one, or when an admin creates it.
- A buyer can read a supplier's organisation, products, prices and availability only through an `invited` or `active` connection. A supplier can read only buyers connected to it, and only the fields an order needs.
- AI product matching uses only products from the buyer's connected suppliers.

## Alternatives considered
- One global catalogue visible to every buyer, as in the prototype demo. Rejected by D1.
- Per-buyer price lists. Out of scope under D1. The model allows a `connection_prices` table later.

## Consequences
"Add a new supplier" first looks for an existing supplier with the same email. If one exists, it offers a connection instead of creating a duplicate. Admin views read across organisations through admin-only policies.
