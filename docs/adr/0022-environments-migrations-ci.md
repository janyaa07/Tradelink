# ADR 0022: Environments, migrations and CI

Status: Proposed

## Context
The brief asks for:
- separate development, preview and production configuration;
- a migration for every schema change, and generated types;
- CI for lint, type checks, tests, build and migrations;
- a `main` branch that can always be deployed.

## Decision
- **Development** uses the local Supabase CLI stack (Docker) with seed data. `.env.local` holds the real local values and is git-ignored. `.env.example` lists every variable with placeholders.
- **Preview** uses Vercel preview deployments for each pull request. They point at a shared preview Supabase project, or at Supabase branches if the plan allows, seeded with demo data.
- **Production** has its own Supabase project and Vercel production environment. Its variables live only in Vercel.
- **Migrations:**
  - live in `supabase/migrations/*.sql`, are created with `supabase migration new`, and are never edited after merge;
  - CI runs `supabase db reset` on a fresh stack to prove the migrations and seed apply cleanly;
  - CI then runs `supabase gen types typescript` and fails if `src/data/database.types.ts` differs.
- **CI (GitHub Actions)** runs install, lint, type check, token check, unit tests, local Supabase start, pgTAP tests, integration and concurrency tests, build, Playwright end-to-end and accessibility tests, then uploads reports. All of these must pass to merge to `main`.
- **AI evaluation** runs in a separate workflow, on demand and nightly, with an Anthropic key stored as a GitHub secret.
- **Release:**
  - Until the owner approves Phase 7, production deploys are manual. After that, merging to `main` deploys to production.
  - Production migrations run with `supabase db push` from a protected GitHub environment that needs manual approval.
- **Branching:** short-lived branches, Conventional Commits, and one PR per milestone or smaller.

## Alternatives considered
- Running migrations when the app starts. Rejected: unsafe when several instances start at once.

## Consequences
Before the Phase 2 work that needs them, the owner creates the GitHub repository, the Vercel project and the Supabase projects, or approves Claude creating them with the connected tools.
