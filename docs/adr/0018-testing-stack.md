# ADR 0018: Testing stack: Vitest, pgTAP, Playwright and axe

Status: Proposed

## Context
The brief asks for unit, integration, RLS, concurrency, AI, end-to-end and accessibility tests.

## Decision
- **Vitest 5** for:
  - unit tests of domain rules, money, state machines, invoice checks and parsers;
  - integration tests that call server actions and database functions on the local Supabase stack, signed in as seeded users from different organisations.
- **pgTAP**, run with `supabase test db`, for database functions, RLS policies, constraints, triggers and the ledger invariant. RLS tests act as a given user by setting `set local role authenticated` and `request.jwt.claims`.
- **Concurrency tests** in Vitest that open many connections and run checkouts and adjustments against the same product at once.
- **Playwright 1.64** for end-to-end flows at 390x844 (phone), 820x1180 (tablet) and 1280x800 (laptop), in light and dark mode. Screenshots are compared with approved baselines.
- **@axe-core/playwright** on every page in both themes. Any WCAG 2.2 A or AA violation fails the run.
- **AI evaluation** as a separate script and CI job (see ADR 0008).

## Alternatives considered
- Jest. Rejected: Vitest is faster and uses Vite-style config.
- Cypress. Rejected: Playwright handles several viewports, themes and browsers more simply.

## Consequences
CI needs Docker to run the local Supabase stack. GitHub-hosted Ubuntu runners have it.
