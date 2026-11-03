# ADR 0013: Scheduled jobs and derived attention items

Status: Proposed

## Context
Admin attention items depend on elapsed time: invitations older than 24 hours, problems unanswered for 4 hours, orders pending for 30 minutes. System status needs real health checks, and some housekeeping runs daily.

## Decision
- Attention items are a SQL view, computed when read, from the rules in `docs/DISCOVERY.md` section 6.6. Assignments and "Mark handled" are stored in `attention_states`, keyed by the item key. No job is needed to create items.
- Vercel Cron calls protected Route Handlers, which check `Authorization: Bearer CRON_SECRET`:
  - `/api/cron/health` every 5 minutes. It checks the web app, API, database, AI reader (with one tiny request), email provider and last backup, and writes the results to `service_checks`.
  - `/api/cron/email-outbox` every minute. It sends pending emails.
  - `/api/cron/daily` at 02:00 Asia/Singapore. It expires invitations, clears reorder skips, recalculates usage rates for usual items, and deletes AI run text older than 90 days.
- Vercel Hobby runs cron jobs at most once a day. If the project stays on Hobby, the 5-minute and 1-minute jobs move to Supabase `pg_cron`, using `pg_net` to call the same endpoints.

## Alternatives considered
- Creating attention items with a scheduled job. Rejected: more moving parts, and data goes stale between runs.

## Consequences
The Vercel plan (Hobby or Pro) decides where the frequent jobs run. The handlers are the same either way.
