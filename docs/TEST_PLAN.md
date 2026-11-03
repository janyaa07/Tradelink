# Test plan

Status: Phase 1 draft for review. Tooling is in ADR 0018. `docs/TESTING.md` (Phase 2) will explain how to run each suite.

## 1. Test levels

| Code | Level | Tool | Runs against | Where |
| --- | --- | --- | --- | --- |
| U | Unit: pure domain rules and helpers | Vitest | Nothing external | `src/**/*.test.ts` |
| D | Database: constraints, triggers, functions, RLS | pgTAP (`supabase test db`) | Local Supabase | `supabase/tests/*.sql` |
| I | Integration: server actions and Route Handlers through the real database, AI and email mocked | Vitest | Local Supabase | `tests/integration/**` |
| C | Concurrency: parallel transactions | Vitest with many connections | Local Supabase | `tests/concurrency/**` |
| E | End to end: user flows in a browser | Playwright | `next start` + local Supabase | `tests/e2e/**` |
| A | Accessibility: axe on every page in both themes | @axe-core/playwright | as E | `tests/e2e/a11y.spec.ts` |
| V | Visual: screenshots against approved baselines and the prototype | Playwright | as E | `tests/visual/**` |
| X | AI evaluation with the real API | Vitest script | Anthropic API | `evals/**` |
| P | Performance budgets | Lighthouse CI | Preview deployment | CI job |

## 2. Environments and data

- Every I, C, E, A and V run starts from `supabase db reset`, which loads the demo seed (DATA_MODEL section 7) plus test-only fixtures: buyer C and supplier Z, who are not connected to anyone, so isolation can be tested.
- Time is fixed with a clock helper (Asia/Singapore) so cut-offs, greetings, weeks and "hours ago" are stable. Database tests set `now()` with a test function only available in the test schema.
- Claude is mocked in U, I and E with recorded, schema-valid responses and error cases. Email is captured by the local mail catcher.
- E runs at three viewports (phone 390x844, tablet 820x1180, laptop 1280x800) and two themes (light, dark). Critical flows run on all six combinations; other flows run on phone light and laptop dark.

## 3. Unit tests (U)

| Area | What is tested |
| --- | --- |
| Money | Parsing, cents arithmetic, rounding, formatting `S$52.00`, large values, rejection of floats |
| Quantities | kg to pack rounding up, whole-number checks, plural units ("2 boxes", "1 bag") |
| Stock | Available, health (`out`, `low`, `healthy`, `unconfirmed`), stock bar width |
| State machines | Every allowed transition per role, every disallowed one; parity with the SQL seed |
| Restock plan | Days left, 7-day quantity, capped by availability, skip handling, toggle off |
| Cut-off and delivery dates | Before and after cut-off, delivery days, lead time, weekends, Asia/Singapore boundaries |
| Rule-based reader | The prototype's sample message and 40 more cases: units, "x 2", "and", "&", filler words, aliases, ties, no match |
| Draft checks | Unresolved lines, over-stock lines, blockers text, supplier split and totals |
| Budget | Week boundaries (Monday start), warning threshold |
| Invoice checks | Higher price per line, unexpected fee, tax lines ignored, total mismatch, bank fingerprint match and mismatch, missing saved details |
| Attention rules | Each of the ten rules, thresholds (24 h, 4 h, 30 min), sorting, dismissal |
| Negotiation | Gap calculation, message limits, allowed responses |
| Validation schemas | Every Zod schema accepts valid input and rejects each invalid case with the right copy |
| Logger | Redaction of secrets, tokens, emails and raw text |
| Error mapping | Every `TL` code maps to the documented copy |

## 4. Database tests (D)

### 4.1 RLS matrix
For each table and view in DATA_MODEL section 5.2, the test signs in as: buyer A member, buyer B member, buyer C (unconnected), supplier X member (connected to A), supplier Z (unconnected), admin with `aal1`, admin with `aal2`, and anonymous. It asserts the exact rows each can select, and that `insert`, `update` and `delete` are refused for all of them. Expected results come from SECURITY section 4.

### 4.2 Functions
For every `api` function: success for the right role, `TL403` for every other role, `TL404` across organisations, `TL409` for each invalid state, idempotent replay, audit row written, notification and outbox rows written where specified.

### 4.3 Integrity
- Ledger replay equals `inventory_levels` after a scripted sequence of every movement type.
- Append-only tables refuse update and delete for all roles.
- Constraints: `reserved <= on_hand`, non-negative stock, price range, unique pending invitation, one open late issue per order.
- State transition triggers refuse direct status updates outside the table.

## 5. Concurrency tests (C)

| Test | Expectation |
| --- | --- |
| 50 parallel checkouts of 1 to 3 units against 10 available | Total reserved is at most 10; every failure is `STOCK_SHORT`; ledger consistent |
| Parallel checkouts touching the same two products in opposite order | No deadlock (ordered locking); all finish within 5 s |
| Supplier adjusts stock down while buyers check out | Never `reserved > on_hand`; adjustment refused when it would break it |
| Same idempotency key sent 10 times in parallel | One order set created; all calls return the same result |
| Two tabs accept the same invitation | One succeeds; the other gets "This invitation is no longer valid." |
| Supplier accepts while buyer cancels the same order | Exactly one wins; the other gets `INVALID_TRANSITION` |

## 6. AI tests

- **Mocked (U and I):** schema validation, unknown product IDs dropped, kg conversion, assumed quantities, timeout fallback, refusal fallback, invalid output fallback, usage logged, catalogue scoped per buyer, Ask tools return only the caller's data and validate their inputs, no tool writes.
- **Evaluation (X):** `evals/order-reading` (at least 150 labelled messages), `evals/invoices` (at least 20 samples with expected extraction), `evals/injection` (at least 30 adversarial messages, invoices and supplier names). Metrics and thresholds in AI-06. Results are saved as CI artifacts and summarised in `docs/TESTING.md` after each run. A threshold miss blocks release, not pull requests.

## 7. End-to-end flows (E)

Critical flows (all viewports and both themes):

1. Buyer reads a typed order, fixes a "Check this" line, adds a missing product, confirms, and sees two orders placed and stock reserved.
2. Supplier accepts one order with a date, part accepts another; buyer sees the part-delivery To do and orders the rest.
3. Supplier marks out for delivery; buyer reports a problem; supplier offers a credit; buyer sees the reply and marks the credit received.
4. Buyer uploads an invoice with a higher price and one with new bank details; sees "Needs review" and "Do not pay yet"; admin sees the security item.
5. Supplier disputes a problem; admin resolves it.
6. Buyer adds a product from a new supplier; the invitation email link is accepted; supplier confirms stock and accepts the waiting order.
7. Below-minimum order: buyer sends an AI-drafted request; supplier proposes a fee; buyer accepts the fee.
8. Admin signs in with two-factor, filters attention items, assigns one and suspends a supplier.
9. Sign in, forgot password and set a new password.
10. Theme switch and persistence across reloads.

Other flows: Availability search and chips, Insights figures, Ask questions and "Review order", inventory add, receive, adjust and change price, stock history and activity, notifications live update, team invitation, offline banner, every empty state, More sheet keyboard use, direct URL access to another organisation's order (not found).

## 8. Accessibility (A)

- axe on every route in light and dark, with forms open and with errors shown. Zero WCAG 2.2 A or AA violations.
- Keyboard-only runs of flows 1, 3, 4 and 8 with focus order and visible focus checked.
- Screen reader smoke test by hand each phase (NVDA on Windows, VoiceOver on iOS) for Home, Order review, Orders and Needs attention.
- Reduced motion: no transitions when `prefers-reduced-motion: reduce`.

## 9. Visual comparison (V)

- Phase 6 captures every prototype screen at 390, 820 and 1280px in light and dark (the prototype is driven by its demo controls), and the same screens in the app with the same seed data.
- A reviewer compares them side by side; differences that are not justified by real data or an approved change are bugs.
- Approved app screenshots become baselines; later pull requests fail on a pixel difference above 0.5% per screen unless the baseline update is approved.

## 10. Performance (P)

Lighthouse CI on the preview deployment for the three home pages, Order review and Orders, mobile profile: LCP under 2.5 s, CLS under 0.1, total blocking time under 200 ms, client JavaScript under 150 KB gzipped per route.

## 11. Story to test map

Codes as in section 1. Each listed code means at least one test of that level asserts the story's acceptance criteria.

| Story | Tests | Story | Tests | Story | Tests |
| --- | --- | --- | --- | --- | --- |
| SH-01 | E A V | BUY-14 | U I E A | SUP-08 | U D I E |
| SH-02 | U E V | BUY-15 | U E | SUP-09 | D I E |
| SH-03 | I E V | BUY-16 | U D C E | SUP-10 | I E A |
| SH-04 | E V | BUY-17 | U E | SUP-11 | U D I E |
| SH-05 | E | BUY-18 | U D I E | SUP-12 | U D I E |
| SH-06 | E A | BUY-19 | D I E | SUP-13 | D I E |
| SH-07 | E | BUY-20 | U E | SUP-14 | D I E |
| SH-08 | A E | BUY-21 | U I E | SUP-15 | D C I E |
| SH-09 | D I E | BUY-22 | D C I E | SUP-16 | D E |
| SH-10 | D E | BUY-23 | E | SUP-17 | D E |
| SH-11 | D I | BUY-24 | U I E | SUP-18 | U D I E |
| SH-12 | U V | BUY-25 | U D I E | SUP-19 | U D I E |
| SH-13 | P | BUY-26 | D I E | SUP-20 | D C I E |
| SH-14 | D I E | BUY-27 | I E A | SUP-21 | D I E |
| AUTH-01 | I E | BUY-28 | D I E | SUP-22 | D I E |
| AUTH-02 | E | BUY-29 | D I E | ADM-01 | I E V |
| AUTH-03 | I E | BUY-30 | U D I E | ADM-02 | U D E |
| AUTH-04 | D I E | BUY-31 | D I E | ADM-03 | E |
| AUTH-05 | I E | BUY-32 | I E | ADM-04 | D E |
| AUTH-06 | D I E | BUY-33 | U I | ADM-05 | D E |
| AUTH-07 | D C I E | BUY-34 | U D I E | ADM-06 | D I E |
| AUTH-08 | I E | BUY-35 | D I E | ADM-07 | D I E |
| AUTH-09 | E | BUY-36 | I E | ADM-08 | D E |
| BUY-01 | I E V | BUY-37 | D E | ADM-09 | D E |
| BUY-02 | D I E | BUY-38 | D I E | ADM-10 | D E |
| BUY-03 | D I E | BUY-39 | U E A | ADM-11 | D E |
| BUY-04 | D E | BUY-40 | D E | ADM-12 | D I E |
| BUY-05 | U E | BUY-41 | D E | ADM-13 | D E |
| BUY-06 | D E | BUY-42 | D E A | ADM-14 | D E |
| BUY-07 | D E | BUY-43 | U I E | ADM-15 | D I E |
| BUY-08 | U D E | BUY-44 | I E | ADM-16 | D I E |
| BUY-09 | E | BUY-45 | E | ADM-17 | U I E |
| BUY-10 | U I E | BUY-46 | U D E | ADM-18 | D E |
| BUY-11 | U I E | BUY-47 | I E A | ADM-19 | E |
| BUY-12 | I E | BUY-48 | U I X | ADM-20 | D I |
| BUY-13 | E | BUY-49 | I E | AI-01 to AI-03 | U I X |
| SUP-01 | I E V | BUY-50 | I X | AI-04 | I X |
| SUP-02 | D E | SUP-04 | D I E | AI-05 | I |
| SUP-03 | D E | SUP-05 | U D I E | AI-06 | X |
| OPS-01 | D | SUP-06 | D I E | AI-07 | U I X |
| OPS-02 | C D | SUP-07 | D I E | AI-08 | U I X |
| OPS-03 | D C I | OPS-07 | I | OPS-10 | D I |
| OPS-04 | U D | OPS-08 | D | OPS-11 | CI config |
| OPS-05 | I | OPS-09 | D I | OPS-12 | P |
| OPS-06 | U | | | | |

## 12. Exit criteria

- **Per pull request:** all U, D, I, C, E (critical subset) and A tests pass; coverage of `src/domain` at least 90% lines and branches; no new axe violations.
- **Per phase:** every story in the phase has passing tests for every acceptance criterion; full E suite on all six viewport and theme combinations.
- **Release (Phase 7):** everything above, AI evaluation thresholds met, visual comparison signed off, performance budgets met, security checklist complete, smoke tests on production pass.
