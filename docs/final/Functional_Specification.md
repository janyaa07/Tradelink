<img src="../../design-handoff/logos/tradelink-logo-green.svg" alt="Tradelink" width="96">

# Tradelink Functional Specification

| Field | Value |
| --- | --- |
| Document | Functional Specification Document (FSD), as built |
| Product | Tradelink, with Tradelink AI |
| Version | 1.1 |
| Date | 4 November 2026 |
| Status | Draft for review |
| Owner | Janya Mali |
| Related | [User Guide](User_Guide.md), [Technical Specification](Technical_Specification.md), [User stories](../USER_STORIES.md), [Decision records](../adr/README.md) |

## Contents

1. [Purpose, audience and scope](#1-purpose-audience-and-scope)
2. [Product overview](#2-product-overview)
3. [Scope](#3-scope)
4. [Users and permissions](#4-users-and-permissions)
5. [Feature catalogue](#5-feature-catalogue)
6. [Functional requirements](#6-functional-requirements)
7. [User journeys](#7-user-journeys)
8. [Business rules](#8-business-rules)
9. [State models](#9-state-models)
10. [Screens](#10-screens)
11. [Notifications](#11-notifications)
12. [AI behaviour](#12-ai-behaviour)
13. [Reports and insights](#13-reports-and-insights)
14. [Non-functional requirements](#14-non-functional-requirements)
15. [Key product decisions](#15-key-product-decisions)
16. [Requirements traceability](#16-requirements-traceability)
17. [Glossary](#17-glossary)

## 1. Purpose, audience and scope

| Topic | Detail |
| --- | --- |
| Purpose | Define what Tradelink does today and the rules behind it. Every statement comes from the code, migrations, tests or an accepted decision record. Planned but unbuilt features are marked **Not built**. |
| Audience | Product owner, design, QA, business reviewers and interviewers. Engineers should read the [Technical Specification](Technical_Specification.md). |
| Scope | The buyer, supplier and admin web app, sign-in and Tradelink AI. The unused Tradelink AI shop foundation at `/r` is covered only in the Technical Specification. |
| Sources | `app/`, `src/`, 17 applied migrations in `supabase/migrations/`, tests, [`USER_STORIES.md`](../USER_STORIES.md), [`adr/`](../adr/README.md). Where older documents disagree, this document follows the code. |
| IDs | F-xx feature, FR-xxx requirement, BR-xx business rule, NFR-xx non-functional requirement, SCR-xx screen, J-xx journey, DEC-xx decision. Story IDs (SH, AUTH, BUY, SUP, ADM, AI, OPS) come from `USER_STORIES.md`. |

## 2. Product overview

**Problem.** Small food businesses in Singapore order stock over WhatsApp and phone calls. Orders get lost in chat, nobody knows what stock is really available, short or damaged deliveries are hard to follow up, and spending is hard to track. Suppliers re-type orders and find stock problems late.

| Goals | Non-goals |
| --- | --- |
| One place to order from every supplier and manage those orders | Moving money: no payments, invoices or Stripe |
| Stock checked and reserved when an order is placed | Accounting, tax or delivery routing |
| A clear record of every delivery, problem and credit | A public marketplace |
| An assistant that acts only after the person confirms | AI that changes data on its own |
| An operations team that sees what needs attention and settles disputes | |

| Role | Value today |
| --- | --- |
| Buyer | Order by typing to Tradelink AI or from usual items; one review step with stock, minimums, cut-offs and budget; delivery checks, problems and credits; weekly insights |
| Supplier | Orders arrive with stock reserved; accept, part accept (now or as a second delivery) or reject; inventory with full history; problems in one list |
| Admin | A work queue with assignment, dispute resolution, supplier suspension and an append-only audit log |

## 3. Scope

| Area | Built | Not built | Reason |
| --- | --- | --- | --- |
| Accounts | Sign-in, sign-out, password reset, self sign-up | Two-factor sign-in, invitation onboarding, team members | Easy to try ([ADR 0024](../adr/0024-self-sign-up-without-two-factor.md)) |
| Ordering | Tradelink AI, usual items, products, cart review, one order per supplier, stock reservation | Minimum-order negotiation and fees | Designed in [ADR 0020](../adr/0020-minimum-order-negotiation.md), not built |
| Fulfilment | Accept, part accept, reject, deliver, second delivery, date changes, messages | Routing | Outside the brief |
| After delivery | All here, Not here yet, problems, answers, credits, disputes | Invoices of any kind | Not built; an `invoice` problem type exists but cannot be created |
| Payments | None | Payments, subscriptions, Stripe | Owner decision, 4 November 2026 |
| New suppliers | A buyer adds an *invited* supplier record; admins see a follow-up after 24 hours | Invitation email, accept page, claiming the record | Replaced by self sign-up (ADR 0024) |
| Notifications | In-app bell panel and Alerts page | Email, SMS, push | No provider; push code is not switched on |
| Admin | Attention queue (lead and operators), disputes, suspend and reactivate, read-only lists, audit log | Approving, inviting or editing people; system status | Not built |
| Devices | Responsive web app, manifest, offline page | Native apps, install prompt, offline ordering | See DEC-01 |

## 4. Users and permissions

| Role | Description | Main goals |
| --- | --- | --- |
| Buyer | Member of a buyer business; one person, one business | Stay stocked, order fast, check deliveries, get credits, keep to budget |
| Supplier | Member of a supplier business | Turn orders into deliveries, keep stock and prices right, answer problems |
| Admin lead | Operator with `admin_profiles.is_lead` (Hannah in the demo) | See and assign the whole queue, settle disputes, oversee suppliers |
| Admin operator | Any other operator | Work the items assigned to them |

Y = allowed, Own = own records, Conn = businesses they trade with, N = refused. Database functions and Row Level Security enforce this; opening another role's pages is refused and logged.

| Action | Buyer | Supplier | Lead | Operator |
| --- | --- | --- | --- | --- |
| Create an account by sign-up | Y | Y | N | N |
| See products and prices | Conn | Own | Y | Y |
| Use Tradelink AI | Y | Y | N | N |
| Save a cart, place orders | Y (Conn) | N | N | N |
| Cancel an order | Own, while pending | N | N | N |
| Accept, part accept, reject, deliver, deliver the rest | N | Own (deliver also while suspended) | N | N |
| Cancel the rest, ask to move a date, send a message | Own | Own | N | N |
| All here, Not here yet, report a problem, confirm a credit | Own | N | N | N |
| Answer a problem | N | Own | N | N |
| Add a product for a supplier, add a supplier not on Tradelink | Y (Conn) | N | N | N |
| Add products, receive stock, change prices, adjust stock, edit terms | N | Own | N | N |
| Edit budget, alerts and usual items | Own | N | N | N |
| See the attention queue | N | N | All | Assigned only |
| Assign an attention item | N | N | Y | N |
| Mark an attention item handled | N | N | Y | Assigned only |
| Resolve disputes, suspend suppliers, see all orders and accounts | N | N | Y | Y |
| Read the audit log | Rows about own business (database only) | Activity page | Y | Y |

## 5. Feature catalogue

| ID | Feature | Role | Status | Stories |
| --- | --- | --- | --- | --- |
| F-01 | Sign in, sign out, reset password | All | Built | AUTH-01 to AUTH-03 |
| F-02 | Self sign-up | Buyer, supplier | Built | AUTH-10 |
| F-03 | Role routing and access | All | Built | AUTH-06, AUTH-09 |
| F-04 | App shell, Home with Next up, theme, empty and error states | All | Built (theme per browser) | SH-01 to SH-06, SH-12; BUY-01 to 04, 07 to 09; SUP-01, 02; ADM-01 |
| F-05 | In-app notifications | All | Built | SH-09, ADM-08 |
| F-06 | Tradelink AI assistant with confirm cards | Buyer, supplier | Built | BUY-45, 47 to 50; AI-04, AI-05 |
| F-07 | Order from typed text | Buyer | Partial (no rule-based fallback in the live app) | BUY-10, BUY-11, AI-01 to AI-03 |
| F-08 | Usual items and tomorrow's order | Buyer | Built | BUY-08, BUY-12, BUY-46 |
| F-09 | Products, cart review, place orders, stock reservation | Buyer | Built | BUY-13 to 17, 20, 22, 23, 42 |
| F-10 | Below-minimum warning | Buyer, supplier | Built (no negotiation) | BUY-24 |
| F-11 | Add a missing product | Buyer | Built | BUY-18 |
| F-12 | Add a supplier not on Tradelink | Buyer | Partial (no invitation sent) | BUY-19, ADM-06 |
| F-13 | Orders, delivery checks, problems, credits | Buyer | Built | BUY-27 to 31, BUY-37 |
| F-14 | Insights and budget | Buyer | Built | BUY-38 to 41, 43, 44 |
| F-15 | Accept, part accept, reject, deliver, second delivery | Supplier | Built | SUP-03 to SUP-07, BUY-21 |
| F-16 | Date changes and order messages | Both | Built | BUY-21 |
| F-17 | Answer problems | Supplier | Built | SUP-09 |
| F-18 | Inventory, stock history, activity, profile | Supplier | Built | SUP-10 to SUP-18, OPS-01 |
| F-19 | Attention queue with lead and operators, disputes | Admin | Built | ADM-02 to ADM-07 |
| F-20 | Orders, suppliers, users, operators, audit log, suspension | Admin | Built (view only except suspension) | ADM-09 to 14, 16, 18, 19; SUP-22 |
| F-21 | No overselling, idempotency, state machines, rate limits | System | Built (rate limits partial) | OPS-02 to OPS-04, OPS-07 |

Not built, with their stories in section 16: two-factor sign-in and invitations, push and live updates, invoices, negotiation, system status and admin connections.

## 6. Functional requirements

Test references are real files; "No automated test" means the behaviour was checked by hand or in code review.

| ID | Requirement: acceptance criteria | Role | Test reference |
| --- | --- | --- | --- |
| FR-001 | **Sign in with email and password.** Lands on the role home or a safe `next` path; wrong details show "Check your email and password.". | All | `src/features/auth/routing.test.ts`, `e2e/smoke.spec.ts` |
| FR-005 | **Create a buyer or supplier account.** Active business created and connected to every active business of the other kind; duplicate names refused. | Public | `src/features/auth/signUp.test.ts` |
| FR-006 | **Keep each person in their own area.** A buyer opening `/admin` lands on `/buyer`; the attempt is logged as denied. | All | `src/features/auth/routing.test.ts` |
| FR-010 | **Role navigation and counts.** Top bar on laptop, bottom tabs on phone; counts match their lists. | All | `src/features/shell/nav.test.ts` |
| FR-013 | **In-app notifications with one action each.** The action opens the right order section. | All | `src/features/notifications/routes.test.ts` |
| FR-020 | **Home shows what needs the buyer.** Next up steps from the data; a clear message when nothing is due. | Buyer | `src/domain/todos.test.ts`, `src/domain/home.test.ts` |
| FR-021 | **Suggest tomorrow's order.** Items under 3 days left topped up to 7 days, within stock; Not today hides it. | Buyer | `src/domain/reorder.test.ts` |
| FR-022 | **Order through Tradelink AI.** Nothing changes until the buyer taps a confirm card; no invented products. | Buyer | `src/features/ai/tools.test.ts` |
| FR-025 | **Review the cart.** Lines by supplier, Checked line, cut-offs, budget; Place disabled while a line needs fixing. | Buyer | `src/features/ordering/line-view.test.ts`, `src/features/ordering/cart-groups.test.ts` |
| FR-028 | **Warn below a supplier's minimum.** Warning with the gap; placing still allowed; order flagged for both sides. | Buyer | `src/domain/minimum.test.ts` |
| FR-030 | **Place orders and reserve stock.** One order per supplier; a shortfall places nothing and highlights the lines. | Buyer | `tests/concurrency/reservations.test.ts`, `e2e/order-flow.spec.ts` |
| FR-032 | **Add a missing product.** Unconfirmed product with stock 0; supplier told; duplicates refused. | Buyer | No automated test |
| FR-033 | **Add a supplier not on Tradelink.** Invited record created; nothing is sent to the supplier. | Buyer | `src/features/ai/tools.test.ts` |
| FR-042 | **Cancel a pending order.** Stock released, supplier told; not possible once accepted. | Buyer | No automated test |
| FR-045 | **Report a problem on a delivered line.** Amount = quantity × unit price; note at most 500 characters. | Buyer | `e2e/order-flow.spec.ts` |
| FR-046 | **Confirm a credit arrived.** Credit stays open until confirmed; supplier told. | Buyer | `e2e/order-flow.spec.ts`, `src/features/buyer/orders/summary.test.ts` |
| FR-048 | **Ask to move a delivery date.** Only the other side can answer; accepting moves the date. | Both | `src/features/ai/tools.test.ts` |
| FR-050 | **Insights.** Rejected and cancelled orders never count as spend. | Buyer | `src/domain/insights.test.ts`, `src/features/insights/summary.test.ts` |
| FR-062 | **Accept an order.** Date today or later; buyer-added products confirmed first; shortfall refused. | Supplier | `src/features/supplier/dates.test.ts`, `e2e/order-flow.spec.ts` |
| FR-063 | **Part accept an order.** Unsent stock released; the rest dropped or kept for a later date (not reserved). | Supplier | No automated test |
| FR-065 | **Deliver an order and the rest.** Stock leaves on hand and reserved; the rest needs free stock. | Supplier | `e2e/order-flow.spec.ts` |
| FR-067 | **Answer a problem.** Credit needs an amount above 0; Replace not offered for late problems; dispute alerts admins. | Supplier | `src/features/supplier/issues.test.ts` |
| FR-080 | **Attention queue.** High first, then oldest; the lead sees all, operators only their own. | Admin | `src/features/admin/attention.test.ts` |
| FR-082 | **Assign an item.** Saved choice stays shown; operators see "Assigned to you" and cannot assign. | Lead | `src/features/admin/attention.test.ts` |
| FR-084 | **Resolve a dispute.** Credit buyer or Close, no credit; both sides told. | Admin | No automated test |
| FR-085 | **Suspend or reactivate a supplier.** Pending orders cancelled and stock released; accepted orders can still be delivered. | Admin | No automated test |
| FR-091 | **AI changes data only after a tap.** The change is checked again on the server and runs as the person. | Both | `src/features/ai/tools.test.ts` |
| FR-093 | **AI fails safely.** "Tradelink AI is not set up yet." or "…not available right now"; the rest of the app works. | Both | No automated test |

## 7. User journeys

**J-01 Ordering**

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Buyer | Opens Home | "Place tomorrow's order" when usual items run low | No usual items: use Tradelink AI or Products |
| 2 | Buyer | Adds lines (plan, Tradelink AI, Products) | Lines go to the cart; AI asks first | AI unavailable: use Products |
| 3 | Buyer | Reviews the cart | Checked line, cut-offs, minimum warnings, budget | Over-stock lines block placing |
| 4 | Buyer | Places N orders | One order per supplier, stock reserved, suppliers told | Stock taken meanwhile: nothing placed, lines highlighted |

**J-02 Supplier fulfilment**

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Supplier | Accepts with a date | Lines reserved and repriced; buyer told | Past date, unconfirmed product or short stock refused |
| 1b | Supplier | Part accepts | Unsent stock released; rest dropped or kept for a later date | Sending nothing is a rejection |
| 1c | Supplier | Rejects | Stock released; buyer told | Only while pending |
| 2 | Supplier | Out for delivery, then delivered | Buyer told each time; stock leaves | — |
| 3 | Supplier | Delivers the rest | Taken from free stock; buyer checks again | Short free stock refused |

**J-03 Problems and credits**

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Buyer | All here, Not here yet, or Report a problem | Order checked, or a problem opened and the supplier told | Late already reported: refused |
| 2 | Supplier | Credit, Replace, On the way, or Dispute | Buyer told; a dispute alerts admins | Credit needs an amount above 0 |
| 3 | Buyer | Marks the credit received | Problem closes as credit received; supplier told | Until then it shows "Confirm credit" |

**J-06 Disputes**

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Supplier | Disputes a problem | Buyer sees "Under review"; high-priority attention item | — |
| 2 | Lead | Assigns it | The operator sees it | — |
| 3 | Admin | Credit buyer, or Close, no credit | Credit promised, or Closed; both sides told | Only for disputed problems |

**J-04 Invoice checks: Not built.** There is no invoice upload, reading or check, and the `invoice` problem type cannot be created.

**J-05 Adding a supplier not on Tradelink.** The buyer adds the supplier through a Tradelink AI form card, which creates an invited record that orders can name. After 24 hours admins see "has not joined". No message is sent, and if the supplier signs up under the same name it is refused.

## 8. Business rules

| ID | Rule | Reason |
| --- | --- | --- |
| BR-01 | Money is integer cents in the app and `numeric(12,2)` in the database; times use Singapore time; weeks run Monday to Sunday | Accuracy ([ADR 0019](../adr/0019-money-time-and-quantities.md)) |
| BR-02 | One person belongs to one business; the business kind is the role | Simple tenancy ([ADR 0005](../adr/0005-tenancy-and-connections.md)) |
| BR-03 | Placing creates one order per supplier; a cart holds at most 60 lines | Each supplier handles its own order |
| BR-04 | Available = on hand − reserved; no order may take more | No overselling ([ADR 0006](../adr/0006-inventory-history-and-reservations.md)) |
| BR-05 | Stock is reserved at placing; buyer-added products are reserved when the supplier accepts | Unconfirmed stock is unknown |
| BR-06 | Below a supplier's minimum the order is warned and flagged, never blocked | Decision D5 (ADR 0020) |
| BR-07 | Accepting reprices lines that were not held at the current price | Buyer-added products had no agreed price |
| BR-08 | The rest of a part-accepted order is not reserved; it is taken from free stock on delivery | Stock may arrive later |
| BR-09 | Problems are reported on delivered lines; amount = quantity × unit price; one open late problem per order | Clear, fair claims |
| BR-10 | A promised credit stays open until the buyer confirms it arrived | Owner request, 4 November 2026 |
| BR-11 | Suspending a supplier cancels its pending orders and releases their stock; accepted orders can still be delivered | Buyers are not left waiting |
| BR-12 | The lead sees and assigns every attention item; operators see only their own | Owner request, 4 November 2026 |
| BR-13 | Tradelink AI changes data only after the person taps, and runs as that person | [ADR 0008](../adr/0008-claude-integration.md), [ADR 0010](../adr/0010-untrusted-content-and-prompt-injection.md) |
| BR-14 | Rate limits: 60 AI messages and 30 order messages per person per hour | Cost and abuse control ([ADR 0014](../adr/0014-rate-limiting-in-postgres.md)) |
| BR-15 | The audit log, stock history, price changes and order events cannot be changed or deleted; critical actions carry an idempotency key | Trustworthy history ([ADR 0004](../adr/0004-writes-through-postgres-functions.md)) |

## 9. State models

| Entity | From | Event | To | By | Side effects |
| --- | --- | --- | --- | --- | --- |
| Order | — | Place | Pending | Buyer | Stock reserved; supplier told |
| Order | Pending | Accept or part accept | Accepted | Supplier | Lines reserved and repriced; buyer told |
| Order | Pending | Reject | Rejected | Supplier | Stock released |
| Order | Pending | Cancel, or supplier suspended | Cancelled | Buyer, admin | Stock released |
| Order | Accepted | Out for delivery | Out for delivery | Supplier | Buyer told |
| Order | Out for delivery | Delivered, All here or a problem | Delivered | Supplier, buyer | Stock leaves on hand and reserved |
| The rest | — | Part accept with a later date | Waiting | Supplier | Not reserved |
| The rest | Waiting | Send, then deliver | Out for delivery, Delivered | Supplier | Free stock used; delivery check reset |
| The rest | Waiting | Cancel the rest | Cancelled | Either side | Other side told |
| Problem | — | Report or Not here yet | Open | Buyer | Supplier told |
| Problem | Open | Credit / Replace / On the way / Dispute | Credit promised / Replacement promised / Supplier replied / Disputed | Supplier | Buyer told; dispute alerts admins |
| Problem | Disputed | Credit buyer / Close | Credit promised / Closed | Admin | Both sides told |
| Problem | Credit promised | Mark credit received | Credit received | Buyer | Supplier told |
| Supplier | — | Sign-up | Active | Supplier | Connected to every active buyer |
| Supplier | Active ↔ Suspended | Suspend / Reactivate | Suspended / Active | Admin | Pending orders cancelled on suspend; buyers told |
| Invited business | — | Buyer adds supplier | Invited | Buyer | Admin follow-up after 24 hours; no exit is built |

Delivered, rejected and cancelled orders, and closed or credited problems, are end states. Invoices have no state model: **Not built**.

## 10. Screens

| ID | Role | Screens |
| --- | --- | --- |
| SCR-01 | Public | Sign in, Create an account, Forgot password, Reset password, Offline |
| SCR-10 | Buyer | Home, Tradelink AI, Cart, Products, Orders and order page, Insights, Alerts, Settings |
| SCR-20 | Supplier | Home, Tradelink AI, Orders and order page, Inventory, Stock history, Activity, Alerts, Settings |
| SCR-30 | Admin | Home, Needs attention, Orders, Suppliers and supplier page, Low stock, Users and buyer page, Operators, Audit log, Alerts, Settings |

Every list has a plain empty message. Failures show "This page did not load" with Try again. The [User Guide](User_Guide.md) shows each screen.

## 11. Notifications

All notifications are in-app (bell panel and Alerts page). There is no email, SMS or push.

| Event | Recipient | Action |
| --- | --- | --- |
| Order placed | Supplier | Review order |
| Accepted, part accepted, rejected, out for delivery, delivered | Buyer | Open, See changes, Check delivery |
| Order cancelled (buyer or suspension) | Supplier, buyers | Open |
| The rest cancelled, date change, message | The other side | Answer, Reply, View order |
| Problem reported, delivery late | Supplier | Answer |
| Problem answered | Buyer | Confirm credit, or View order |
| Credit received, product added | Supplier | View order, Inventory |
| Dispute opened, new account | Admins | Open |
| Dispute resolved | Buyer and supplier | Open |
| Supplier suspended or reactivated | Supplier and its buyers | Open |

## 12. AI behaviour

Tradelink AI runs on the server as the signed-in person, using Claude (`claude-sonnet-5-5` by default).

| Capability | User control | Failure handling | Limits |
| --- | --- | --- | --- |
| Answer questions from the person's own data | Read only | "Not available right now" | 60 messages per hour; 6 tool rounds; 2,000 characters per message |
| Buyer actions: cart, order now, place, cancel, check, report, credits, budget, usual items | Confirm card; checked again on the server | Plain error, no partial change | 11 read, 17 confirm, 2 card-only tools |
| Supplier actions: accept, part accept, reject, deliver, answer, stock, prices, terms | Confirm card | As above | 7 read, 17 confirm, 1 card-only |
| Add a product or a supplier | Pre-filled form card the person submits | Duplicates refused | The model cannot call these itself |
| Message, move a date, answer a date request | Confirm card; no added details | — | 30 order messages per hour |
| Explain an order on its page | Read only | — | — |

Text from the database is treated as data, never as instructions. Usage is recorded in `ai_usage`. **Not built:** invoice reading, negotiation drafts, an evaluation set, and a rule-based fallback reader in the live assistant.

## 13. Reports and insights

| Metric | Definition | Shown to |
| --- | --- | --- |
| Spend, budget and pace | Orders placed since Monday (Singapore time), excluding rejected and cancelled; budget default S$900, warning from 75% | Buyer |
| Supplier share, on-time record, price changes, overcharges caught | Over the last 5 weeks; on time = on or before the confirmed date | Buyer |
| Days left | (in shop + on order) ÷ use per day | Buyer |
| Today against a usual day, pick list, quiet customers | Same weekday over 4 weeks; quantities to pack across orders | Supplier |
| Open orders and value, operators online | Pending to out for delivery; seen within 5 minutes | Admin |

## 14. Non-functional requirements

| ID | Category | Requirement | Verification |
| --- | --- | --- | --- |
| NFR-01 | Security | Row Level Security on every table; no write policies; writes only through checked functions | Migration review |
| NFR-02 | Security | AI and secret keys are used only on the server; secrets never in the repository | Code review; repository scan, 4 November 2026 |
| NFR-03 | Security | Refused actions are logged as denied; security headers set (no Content Security Policy yet) | `next.config.ts`; code review |
| NFR-04 | Integrity | Stock is never oversold under parallel orders | `tests/concurrency/reservations.test.ts` (opt-in, not run for this document) |
| NFR-05 | Integrity | Status changes follow section 9; history is append-only; critical actions are idempotent | Database triggers; `e2e/order-flow.spec.ts` |
| NFR-06 | Usability | Sentence case, no exclamation marks or emoji; status shown by word as well as colour | Design rules; code review |
| NFR-07 | Responsiveness | Every buyer and supplier page fits a phone | `e2e/pages.spec.ts` |
| NFR-08 | Performance and availability | No response-time, load or uptime targets measured; liveness check only (`/api/health`) | Not verified |

## 15. Key product decisions

| ID | Decision | Choice | Why | Trade-off |
| --- | --- | --- | --- | --- |
| DEC-01 | Responsive PWA, not native apps | One web app with manifest and offline page ([ADR 0016](../adr/0016-pwa-and-offline.md)) | One codebase, no app store, works from a link | No install prompt or push yet |
| DEC-02 | Next.js and Supabase | Next.js on Vercel; Supabase Postgres, Auth and RLS ([ADR 0002](../adr/0002-nextjs-on-vercel.md), [ADR 0003](../adr/0003-supabase-platform.md)) | Server rendering keeps keys on the server; RLS needs `auth.uid()` | Tied to two platforms |
| DEC-03 | Permissions in server checks and RLS | Reads through RLS; writes only through checked functions ([ADR 0004](../adr/0004-writes-through-postgres-functions.md)) | Holds even if the screens are bypassed | Rules live in SQL |
| DEC-04 | Buyers review AI output before sending | AI drafts; a person taps to confirm | AI can misread; orders commit money | An extra tap; "Order now" uses one confirm tap (Inferred rationale) |
| DEC-05 | Stock reserved in database transactions | Row locks in product order inside one transaction ([ADR 0006](../adr/0006-inventory-history-and-reservations.md)) | No overselling, consistent history | Contention under heavy load (not measured) |
| DEC-06 | How suppliers join | Self sign-up now; secure invitations planned ([ADR 0024](../adr/0024-self-sign-up-without-two-factor.md)) | Easy to try | Anyone can join; invited records cannot be claimed |
| DEC-07 | Invoices checked but never paid | Check-only was decided; nothing built; no payments | Never move money | No invoice protection yet |
| DEC-08 | Light and dark mode from the design system | Tokens generated from `design-handoff` ([ADR 0015](../adr/0015-design-tokens-and-tailwind.md)) | One source for both themes | Theme remembered per browser |
| DEC-09 | One order per supplier | Placed together from one cart | Each supplier owns its delivery and problems | One cart can create several orders |
| DEC-10 | Below-minimum allowed | Warn and flag ([ADR 0020](../adr/0020-minimum-order-negotiation.md)) | Buyers sometimes need a small order | Negotiation not built |
| DEC-11 | Lead and operators | Lead sees and assigns all; operators their own | Owner request; Inferred rationale: clear ownership | No ADR |
| DEC-12 | No payments or Stripe | None | Owner decision, 4 November 2026 | No revenue features |
| DEC-13 | Two deliveries for a part accept | Supplier drops the rest or sends it later | Owner request | The rest is not reserved |
| DEC-14 | Notifications in-app only | In-app for now | Inferred rationale: no email provider; push not on | Updates seen only in the app |

## 16. Requirements traceability

| Area | Built | Partial | Not built |
| --- | --- | --- | --- |
| Shared (SH) | SH-01 to 06, 11, 12 | SH-07, 08, 09 (in-app only), 13 | SH-10, 14 |
| Access (AUTH) | AUTH-01 to 03, 06, 09, 10 | — | AUTH-04, 05, 07, 08 |
| Buyer (BUY) | BUY-01 to 04, 07 to 09, 12 to 18, 20 to 24, 28 to 31, 37 to 50 | BUY-10, 11, 19, 26, 27 | BUY-05, 06, 25, 32 to 36 |
| Supplier (SUP) | SUP-01 to 07, 09 to 18, 22 | — | SUP-08, 19, 20, 21 |
| Admin (ADM) | ADM-01 to 05, 07 to 14, 16, 18 | ADM-06, 19 | ADM-15, 17, 20 |
| AI | AI-05 | AI-01 to 04 | AI-06, 07, 08 |
| Operations (OPS) | OPS-01 to 04, 08 | OPS-05, 06, 07 | OPS-09 to 12 |

Each built story maps to the requirements in section 6 and the tests named there.

## 17. Glossary

| Term | Meaning |
| --- | --- |
| Business, connection | A buyer, supplier or platform company; a trading link between a buyer and a supplier |
| Invited business | A supplier record a buyer created for a business not on Tradelink |
| On hand, reserved, available | Units in stock; units held for orders; the difference |
| The rest | The part of a part-accepted order that comes later |
| Problem, credit, dispute | Something wrong with a delivery; money the supplier takes off; a refusal settled by an admin |
| Confirm card | A card that runs a proposed change only when tapped |
| RLS | Row Level Security: database rules on which rows a person can read |
| Idempotency key | A key that stops a retried action from running twice |
