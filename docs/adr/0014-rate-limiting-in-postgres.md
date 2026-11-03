# ADR 0014: Rate limiting in Postgres

Status: Proposed

## Context
Sign-in, invitations, AI calls and uploads need rate limits. We want to avoid adding a new service unless it is necessary.

## Decision
- Add a `rate_limits` table and an `app.hit_rate_limit(key, limit, window)` function that counts requests per key in a fixed window. Server actions and Route Handlers call it before doing any work.
- A key combines the action with the user ID. On anonymous routes it combines the action with a salted hash of the IP address.
- Initial limits:

| Action | Limit |
| --- | --- |
| AI order reading | 30 per user per hour |
| Invoice reading | 20 per organisation per hour |
| Ask messages | 60 per user per hour |
| Invitations sent | 20 per organisation per day |
| Invitation page lookups | 30 per IP address per 10 minutes |

- Supabase Auth's own limits cover sign-in and password reset.
- A request over its limit gets HTTP 429 and "Too many requests. Try again in a few minutes."
- Vercel's firewall handles high-volume abuse before it reaches the app.

## Alternatives considered
- Upstash Redis. Rejected for now: one more service and secret. It can replace the function later behind the same interface.

## Consequences
Each limited request costs one small write. The daily job clears old rows.
