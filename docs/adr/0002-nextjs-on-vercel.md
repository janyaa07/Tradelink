# ADR 0002: Next.js App Router on Vercel with strict TypeScript

Status: Proposed

## Context
The brief fixes Next.js (App Router), strict TypeScript and Vercel, at current stable versions. Checked on npm on 3 November 2026: `next` 16.4.4, `react` 19.3.1, `typescript` 7.0.2, `tailwindcss` 4.3.4. Next.js 16 needs Node 20.9 or later. Vitest 5 needs Node 22.12 or later, and `@supabase/supabase-js` needs Node 22 or later. The development machine has Node 20.15.

## Decision
- Use Next.js 16 at the latest stable minor when Phase 2 starts, App Router only. Use React Server Components by default, and Client Components only where interaction needs them.
- Use Node 24 LTS locally, in CI and on Vercel, pinned with `.nvmrc` and `engines`.
- Use TypeScript in `strict` mode, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Use the newest TypeScript version that Next.js 16 officially supports at Phase 2. If Next.js does not yet support TypeScript 7, use the latest 6.x and record why.
- Allow no `any`. ESLint (`@typescript-eslint/no-explicit-any`) and code review enforce this.
- Pin every dependency to an exact version that has been published for at least two weeks. Renovate or Dependabot proposes upgrades.
- Host on Vercel, with functions in the Singapore region (`sin1`). Use the Node.js runtime for anything that uses Supabase secrets or the Anthropic SDK.

## Alternatives considered
- Pages Router. Rejected: the brief asks for App Router, and Server Components send less JavaScript to phones.
- Edge runtime everywhere. Rejected: the Anthropic SDK, PDF handling and some Supabase calls are simpler and better supported on Node.js.

## Consequences
The developer must install Node 24 before Phase 2. Next.js minor upgrades become routine PRs that run the full test suite.
