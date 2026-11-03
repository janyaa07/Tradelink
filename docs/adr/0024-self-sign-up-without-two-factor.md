# ADR 0024: Self sign-up for buyers and suppliers; two-factor sign-in removed for now

Status: Accepted (3 November 2026). Supersedes the two-factor and invitation-only parts of ADR 0011, and decisions D2 and D9.

## Context
To make Tradelink easy to try, the owner asked to remove two-factor sign-in for now and to let businesses create their own accounts.

## Decision
- Two-factor sign-in is removed from the app, the request proxy and the database (`app.is_admin()` no longer checks `aal2`). Existing factors on demo accounts were removed.
- `/sign-up` lets a person create a buyer or supplier account with email and password. Business details travel as sign-up metadata. The database trigger `app.handle_new_user` validates them and creates the organisation, profile, membership, settings and an audit entry, and notifies admins.
- The trigger only accepts `buyer` or `supplier`, so admin accounts cannot be created by sign-up.
- New buyers are connected to every active supplier, and new suppliers to every active buyer, so a new account can trade at once. This replaces "connected only by invitation" (D1, D9) until invitations are built.
- Email confirmation is a Supabase project setting. The app handles it being on ("Check your email to confirm your account") or off (signed straight in).

## Alternatives considered
- Keep invitation-only onboarding. Rejected by the owner for now.
- Create accounts with the Supabase admin API. Rejected: it needs the secret key on the server for an anonymous action. The trigger keeps the rules in the database.

## Consequences
- Anyone can create a buyer or supplier account and see connected suppliers' prices. That is acceptable for the demo stage. Bring back invitations or admin approval, and two-factor for admins, before real businesses rely on Tradelink.
- Sign-up is rate-limited by Supabase Auth's own limits.
