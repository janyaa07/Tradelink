# ADR 0003: Supabase for database, auth, storage and realtime

Status: Proposed

## Context
The brief fixes Supabase. We need Postgres with Row Level Security, email and password sign-in with two-factor, private file storage for invoices, and live updates for orders and notifications.

## Decision
- Use one Supabase project per environment. Development uses the local Supabase CLI stack. Preview and production use hosted projects in `ap-southeast-1` (Singapore).
- Use Supabase Auth for users, sessions, password reset and two-factor sign-in with an authenticator app (TOTP).
- Enable RLS on every table in exposed schemas, with no exceptions.
- Keep every Storage bucket private. Files are reached only through short-lived signed URLs, created on the server after an authorisation check.
- Use Supabase Realtime (`postgres_changes`, which respects RLS) to refresh order, issue and notification views.
- Use Supabase's current key model: a publishable key in the browser, and a secret key (which replaces the legacy `service_role` key) on the server only. If the project only offers legacy keys, the same rules apply to `anon` and `service_role`.
- Create clients with `@supabase/ssr` for cookie-based sessions in Server Components, Server Actions, Route Handlers and the request proxy.

## Alternatives considered
- A separate auth provider (Clerk, Auth0). Rejected: a second identity source complicates RLS, which relies on `auth.uid()`.
- Prisma or Drizzle over a direct database connection for app queries. Rejected: it bypasses RLS unless carefully configured, and the security model depends on RLS. The Supabase CLI owns migrations instead.

## Consequences
The secret key is used only in a short, named list of server modules (see `docs/SECURITY.md`). Free-tier projects pause when idle, so preview and production will likely need a paid plan before release. This is to be confirmed with the owner.
