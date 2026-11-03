# ADR 0026: Cards from the database, jobs on pg_cron, and a PWA first

Status: Accepted (3 November 2026).

## Context
The Restock spec makes every agent output a typed, editable card. It needs about 40 timers (merge windows, cut-off reminders, chase ladders, arrival checks), and it assumes a native app with push. The owner chose a PWA now and a store app later.

## Decision
- **Cards.**
  - The agent shows output only through `render_card(type, subject, reason, question)`.
  - The server looks up the card type in a registry, loads the subject at its current version from the database, and builds every price, total, item and date itself. The model supplies wording and references only.
  - The result is validated with the type's Zod schema and stored in `card_instance` through `rs_put_card`, which marks older cards for the same subject as superseded.
  - Taps go to `/api/cards/:id/act` carrying the subject version and a client action id, and the mapped database function refuses stale versions.
  - Chat and cards update live through Supabase Realtime.
- **Jobs.**
  - Every timer is a row in `job` with a unique `dedupe_key`.
  - `pg_cron` calls `/api/jobs/run` every minute through `pg_net`. The route only runs jobs that are already due, so it needs no secret.
  - Handlers re-check their subject's state before acting, so a cancelled or answered PO is never chased (EC28). Failures retry with backoff up to 5 attempts.
  - Vercel cron is not used: the Hobby plan runs it only once a day.
- **PWA.**
  - The Next.js app ships a manifest and a service worker.
  - Web push uses VAPID keys. iPhone push needs the app added to the home screen (iOS 16.4 and later).
  - An offline outbox replays messages and taps with their client ids, and the server de-duplicates them (EC06).
  - `app_release.min_version` drives an update screen.
  - A Capacitor shell adds store listings and native push later without a rewrite.

## Consequences
- **Cards are trustworthy but carry a cost.** A card can never show numbers the database does not hold, and every new card type needs a server builder.
- **Production jobs need the deployed route and the cron schedule.** The schedule is applied only once the route is live in production.
- **Web push needs deployment settings.** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` must be set in Vercel.
