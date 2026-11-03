# ADR 0017: Structured logging, request IDs and health checks

Status: Proposed

## Context
The brief asks for structured logging, safe error handling and health endpoints, with no debug logs left in the code.

## Decision
- A small logger module, `src/lib/logger.ts`, writes one JSON line per event. Each line holds the level, time, request ID, route, user ID (never email or name), organisation ID, duration and error code. It adds no dependency; Vercel collects stdout.
- Secrets, tokens, passwords, raw order text and file contents are never logged. A unit test covers the redaction list.
- The request proxy gives every request an `x-request-id`. Server code passes it to Postgres with `set_config('app.request_id', ...)`, so audit rows and logs can be joined.
- Errors shown to users are mapped from typed error codes to plain copy, such as "Only 3 available. Reduce the quantity." An unexpected error shows "Something went wrong. Try again. If it keeps happening, contact support with code {request id}."
- Health endpoints:
  - `GET /api/health` is the liveness check. It has no dependencies.
  - `GET /api/health/ready` checks that the database, auth and storage can be reached, with timings. Only admins or the cron secret see the detail.
- System status reads the stored check results.

## Alternatives considered
- pino. A good choice, but not needed at our volume. It can replace the module later.
- A hosted error tracker such as Sentry. Deferred. If the owner wants alerts, it can be added in Phase 6 with its own ADR.

## Consequences
Lint blocks `console.log` everywhere except the logger module.
