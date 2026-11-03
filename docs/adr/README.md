# Architecture decision records

Each ADR records one decision: the context, the decision, the options rejected and the consequences. Status is one of Proposed, Accepted, Superseded or Rejected. All ADRs below stay **Proposed** until Phase 1 is approved.

Any new dependency or service needs an ADR before it is used. To change a decision, write a new ADR that supersedes the old one. Do not edit the decision in an accepted ADR.

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-record-decisions.md) | Record architecture decisions | Proposed |
| [0002](0002-nextjs-on-vercel.md) | Next.js App Router on Vercel with strict TypeScript | Proposed |
| [0003](0003-supabase-platform.md) | Supabase for database, auth, storage and realtime | Proposed |
| [0004](0004-writes-through-postgres-functions.md) | Writes go through Postgres functions; reads go through RLS | Proposed |
| [0005](0005-tenancy-and-connections.md) | Organisation tenancy and trading connections | Proposed |
| [0006](0006-inventory-ledger-and-reservations.md) | Inventory ledger and stock reservations | Proposed |
| [0007](0007-state-machines.md) | Explicit state machines in the database and the domain layer | Proposed |
| [0008](0008-claude-integration.md) | Claude behind a server-only AI module | Proposed |
| [0009](0009-ask-assistant-tools.md) | Ask assistant with read-only, organisation-scoped tools | Proposed |
| [0010](0010-untrusted-content-and-prompt-injection.md) | Handling untrusted text, images and PDFs | Proposed |
| [0011](0011-authentication-and-invitations.md) | Authentication, two-factor sign-in and invitations | Proposed |
| [0012](0012-notifications-and-email.md) | Notifications in-app and by email (adds Resend) | Proposed |
| [0013](0013-scheduled-jobs-and-derived-attention.md) | Scheduled jobs and derived attention items | Proposed |
| [0014](0014-rate-limiting-in-postgres.md) | Rate limiting in Postgres | Proposed |
| [0015](0015-design-tokens-and-tailwind.md) | Design tokens to Tailwind, and the control contrast fix | Proposed |
| [0016](0016-pwa-and-offline.md) | PWA with a hand-written service worker; read-only offline | Proposed |
| [0017](0017-logging-and-health.md) | Structured logging, request IDs and health checks | Proposed |
| [0018](0018-testing-stack.md) | Testing stack: Vitest, pgTAP, Playwright and axe | Proposed |
| [0019](0019-money-time-and-quantities.md) | Money, time zone and quantities | Proposed |
| [0020](0020-minimum-order-negotiation.md) | Minimum-order negotiation with buyer approval | Proposed |
| [0021](0021-bank-detail-fingerprints.md) | Bank detail fingerprints for invoice checks | Proposed |
| [0022](0022-environments-migrations-ci.md) | Environments, migrations and CI | Proposed |
| [0023](0023-ask-with-grounded-facts.md) | Ask answers from grounded facts, not a tool runner | Accepted |
