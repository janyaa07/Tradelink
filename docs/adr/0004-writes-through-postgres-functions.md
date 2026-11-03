# ADR 0004: Writes go through Postgres functions; reads go through RLS

Status: Proposed

## Context
Stock must never be oversold, and critical actions must be idempotent. Every status change must follow its state machine. Permissions must hold in the database, not only in the UI. Changes that touch many rows must commit or fail together: placing orders across suppliers, reserving stock, writing the ledger and writing the audit log.

## Decision
- **Reads.** The signed-in user's Supabase client queries tables and views directly. RLS limits rows to the user's organisation, its trading connections or, for admins, the platform.
- **Writes.** Signed-in users get no `insert`, `update` or `delete` policies on business tables. Every change goes through a Postgres function in an `api` schema, declared `security definer` with `set search_path = ''`. Each function:
  1. identifies the caller from `auth.uid()` and checks membership and role, plus `aal2` for admins;
  2. validates its inputs again (the server action has already checked them with Zod);
  3. checks the state transition is allowed and applies it;
  4. locks affected rows with `select ... for update`, always in ascending ID order;
  5. writes the stock ledger, audit log and notifications in the same transaction;
  6. records the idempotency key, and returns the stored result if the key has been used before.
- Next.js Server Actions and Route Handlers stay thin: authenticate, validate with Zod, check the rate limit, call one function, and turn error codes into user-facing copy.
- **Denied attempts.** A function that refuses an action raises a typed error (`TL403`, `TL409`, and so on). Raising rolls back the transaction, so the server action writes the "denied" audit entry afterwards through `api.log_denied`. That function is insert-only and records the caller from the session.

## Alternatives considered
- Writing from TypeScript with several queries. Rejected: there is no single transaction across REST calls, which leaves races on stock.
- RLS-only writes with triggers. Rejected: complex checks spread across triggers are hard to review and test.

## Consequences
Business rules that change data live in SQL and are tested with pgTAP. The TypeScript domain layer repeats validation and the state machines, so the UI gets fast feedback. A test checks that the two agree.
