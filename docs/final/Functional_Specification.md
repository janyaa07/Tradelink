<img src="../../design-handoff/logos/tradelink-logo-green.svg" alt="Tradelink" width="96">

# Tradelink Functional Specification

| Field | Value |
| --- | --- |
| Document | Functional Specification Document (FSD) |
| Product | Tradelink, with Tradelink AI |
| Version | 1.0 |
| Date | 4 November 2026 |
| Status | Draft for review |
| Owner | Janya Mali |
| Related documents | [User Guide](User_Guide.md), [Technical Specification](Technical_Specification.md), [User stories](../USER_STORIES.md), [Decision records](../adr/README.md) |

## Contents

1. [Document control](#1-document-control)
2. [Product overview](#2-product-overview)
3. [Scope](#3-scope)
4. [Users and permissions](#4-users-and-permissions)
5. [Feature catalogue](#5-feature-catalogue)
6. [Functional requirements](#6-functional-requirements)
7. [User journeys](#7-user-journeys)
8. [Business rules](#8-business-rules)
9. [State models](#9-state-models)
10. [Screen specification](#10-screen-specification)
11. [Notifications](#11-notifications)
12. [AI behaviour](#12-ai-behaviour)
13. [Reports and insights](#13-reports-and-insights)
14. [Non-functional requirements](#14-non-functional-requirements)
15. [Key product decisions](#15-key-product-decisions)
16. [Assumptions, dependencies and risks](#16-assumptions-dependencies-and-risks)
17. [Requirements traceability](#17-requirements-traceability)
18. [Known limitations and future improvements](#18-known-limitations-and-future-improvements)
- [Appendix A. Glossary](#appendix-a-glossary)
- [Appendix B. Items for owner review](#appendix-b-items-for-owner-review)

---

## 1. Document control

### 1.1 Purpose

This document defines what Tradelink does today and the business rules behind it. It is an as-built specification: every statement is based on the code, the database migrations, the tests or an accepted decision record. Features that were planned but not built are marked **Not built** and listed in [section 18](#18-known-limitations-and-future-improvements).

### 1.2 Audience

| Reader | Uses this document to |
| --- | --- |
| Product owner | Confirm scope, rules and open decisions |
| Design | Check screens, states and copy against behaviour |
| QA | Derive test cases from requirements and acceptance criteria |
| Business reviewers and interviewers | Understand the product and the reasons behind it |

Engineers should read the [Technical Specification](Technical_Specification.md) for how each part is built.

### 1.3 Scope of this document

| Covered | Not covered |
| --- | --- |
| The buyer, supplier and admin web app (`/buyer`, `/supplier`, `/admin`) | Code structure, database design and deployment (see the Technical Specification) |
| Sign-in, sign-up and password reset | Step-by-step help for users (see the User Guide) |
| Tradelink AI, the assistant inside the app | The separate Tradelink AI shop foundation at `/r`, which the main app does not use. It is described only in the Technical Specification. |

### 1.4 Sources

| Source | Used for |
| --- | --- |
| `app/` routes and `src/` code | Screens, actions, rules and copy |
| `supabase/migrations/` (17 applied migrations) | Permissions, state models, business rules and notifications |
| Unit tests (`src/**/*.test.ts`), e2e tests (`e2e/`) and the concurrency test (`tests/concurrency/`) | Test references |
| [`docs/USER_STORIES.md`](../USER_STORIES.md) | User story IDs |
| [`docs/adr/`](../adr/README.md) | Decision reasons |

Where the code and older documents disagree, this document follows the code. The differences are listed in the Technical Specification appendix "Differences from older documents".

### 1.5 ID conventions

| Prefix | Meaning |
| --- | --- |
| F-xx | Feature |
| FR-xxx | Functional requirement |
| BR-xxx | Business rule |
| NFR-xxx | Non-functional requirement |
| SCR-xx | Screen |
| J-xx | User journey |
| DEC-xx | Product decision |
| SH, AUTH, BUY, SUP, ADM, AI, OPS | User story IDs from `docs/USER_STORIES.md` |

### 1.6 Document history

| Version | Date | Author | Change |
| --- | --- | --- | --- |
| 1.0 | 4 November 2026 | Janya Mali (with Claude) | First as-built specification, from an audit of the code at commit 9250e98 |

---

## 2. Product overview

### 2.1 Problem statement

Small food businesses in Singapore order stock from wholesale suppliers over WhatsApp and phone calls. Orders get lost in chat, nobody knows what stock is actually available, short or damaged deliveries are hard to follow up, and spending is hard to track. Suppliers re-type orders by hand and find out about stock problems late.

### 2.2 Goals and non-goals

| Goals | Non-goals |
| --- | --- |
| One place where buyers order from all their suppliers and suppliers manage those orders | Paying suppliers or collecting payment (no payment features at all) |
| Stock that is checked and reserved when an order is placed, so suppliers are not oversold | Accounting, tax filing or invoicing |
| A clear record of each delivery, each problem and each credit | Delivery routing or driver tracking |
| An assistant (Tradelink AI) that does what the person could do in the app, but only after they confirm | AI that sends orders or changes data on its own |
| A platform team that sees what needs attention and can resolve disputes | A public marketplace or supplier discovery |

### 2.3 Value by user type

| User | What Tradelink gives them today |
| --- | --- |
| Buyer (restaurant, café, bakery) | Order by typing to Tradelink AI or from usual items. One review step with stock, minimums, cut-offs and budget. Delivery checks, problem reports and credit tracking. Weekly spend insights. |
| Supplier (wholesaler) | Orders arrive with stock already reserved. Accept, part accept (now or as a second delivery) or reject. Inventory with a full stock history. Problems to answer in one list. |
| Admin (Tradelink operations) | A work queue of what needs attention, assignment to operators, dispute resolution, supplier suspension, and an append-only audit log. |

---

## 3. Scope

| Area | In scope | Out of scope | Reason |
| --- | --- | --- | --- |
| Accounts | Email and password sign-in, sign-out, password reset, self sign-up for buyers and suppliers | Two-factor sign-in, invitation-only onboarding, team members | Owner decision to make Tradelink easy to try ([ADR 0024](../adr/0024-self-sign-up-without-two-factor.md)) |
| Ordering | Tradelink AI, usual items, product browsing, cart review, one order per supplier, stock reservation | Minimum-order negotiation and delivery fees (BUY-25, SUP-08) | Not built. The design is in [ADR 0020](../adr/0020-minimum-order-negotiation.md). |
| Fulfilment | Accept, part accept, reject, out for delivery, delivered, a second delivery for the rest, delivery date changes, order messages | Delivery routing | Not part of the product brief |
| After delivery | All here, Not here yet, problem reports, supplier answers, credits, disputes | Invoices: upload, reading, checks, bank-detail warnings, manual entry | Not built. An `invoice` problem type exists in the database, but no flow creates it. |
| Payments | None | Paying invoices, subscriptions, Stripe | The product never moves money. The owner decided on 4 November 2026 not to integrate Stripe at all. |
| Suppliers not on Tradelink | A buyer can add one through Tradelink AI. It is saved as an *invited* business, and admins see a follow-up after 24 hours. | Invitation emails, accept or decline pages, claiming the invited record | Not built. ADR 0024 replaced invitations with self sign-up "until invitations are built". |
| Notifications | In-app notifications, the bell panel and the Alerts page for every role | Email, SMS and web push | Push code exists but nothing turns it on or sends it. There is no email provider. |
| Admin | Needs attention (with lead and operator visibility), disputes, supplier suspend and reactivate, read-only orders, users, buyers and operators, audit log | Approving suppliers, inviting buyers, managing users or operators, system status page, connecting a buyer and a supplier | Not built |
| AI | Tradelink AI chat for buyers and suppliers, with read tools and confirm-before-write tools | Invoice reading, negotiation drafts, an evaluation set | Not built |
| Devices | Responsive web app for phone and laptop, an offline page, an app manifest | Native apps, an install prompt, offline ordering | See DEC-01 |

---

## 4. Users and permissions

### 4.1 Roles

| Role | Description | Main goals |
| --- | --- | --- |
| Buyer | A member of a buyer business (organisation kind `buyer`). One person belongs to one business. | Keep the kitchen stocked, order quickly, check deliveries, get credit for problems, stay within budget |
| Supplier | A member of a supplier business (kind `supplier`) | Turn orders into deliveries, keep stock and prices right, answer problems |
| Admin: operations lead | A Tradelink operator whose `admin_profiles.is_lead` flag is set (Hannah Lim in the demo data) | See the whole attention queue, assign items, resolve disputes, oversee suppliers |
| Admin: operator | Any other Tradelink operator (kind `platform`) | Work through the attention items assigned to them |
| Not signed in | Anyone | Sign in, create an account, reset a password |

The role comes from the business the person belongs to. There is no per-person role inside a business (owner or staff) in the main app.

### 4.2 Permissions matrix

Y = allowed, N = refused, Own = only their own records, Conn = only with businesses they trade with.

| Action | Buyer | Supplier | Admin lead | Admin operator | Enforced by |
| --- | --- | --- | --- | --- | --- |
| Sign in, sign out, reset password | Y | Y | Y | Y | Supabase Auth |
| Create an account by sign-up | Y (as a buyer business) | Y (as a supplier business) | N (admin accounts cannot be created by sign-up) | N | `app.handle_new_user` trigger |
| Open another role's pages | N (redirected, logged as denied) | N | N | N | Request proxy and `requireRole` |
| See products and prices | Conn | Own | Y | Y | RLS `can_see_product` |
| Use Tradelink AI | Y | Y | N | N | `/api/ai/chat` route check |
| Save a cart | Own | N | N | N | `save_draft` |
| Place orders | Y (Conn suppliers) | N | N | N | `place_orders` |
| Cancel an order | Own, while pending | N | N | N | `cancel_order` |
| Accept, part accept or reject an order | N | Own orders | N | N | `accept_order`, `part_accept_order`, `reject_order` |
| Mark out for delivery or delivered | N | Own orders (also while suspended) | N | N | `mark_out_for_delivery`, `mark_delivered` |
| Send or deliver the rest | N | Own orders (also while suspended) | N | N | `mark_rest_out_for_delivery`, `deliver_rest` |
| Cancel the rest | Own orders | Own orders | N | N | `cancel_rest` |
| Ask to move a delivery date | Own orders | Own orders | N | N | `propose_delivery_date` |
| Answer a date request | The side that did not ask | The side that did not ask | N | N | `answer_delivery_date` |
| Send an order message | Own orders | Own orders | N | N | `send_order_message` |
| Confirm All here | Own delivered orders | N | N | N | `confirm_all_here` |
| Report Not here yet | Own orders out for delivery | N | N | N | `report_not_here` |
| Report a problem | Own delivered orders | N | N | N | `report_problem` |
| Answer a problem | N | Own | N | N | `answer_issue` |
| Mark a credit received | Own | N | N | N | `mark_credit_received` |
| Resolve a dispute | N | N | Y | Y | `resolve_dispute` |
| Add a product for a supplier | Conn (active or invited supplier) | N | N | N | `buyer_add_product` |
| Add a supplier not on Tradelink | Y | N | N | N | `buyer_add_supplier` |
| Add a product to own catalogue | N | Own | N | N | `supplier_add_product` |
| Receive stock, confirm a buyer-added product, change price, adjust stock | N | Own | N | N | `receive_stock`, `confirm_product_stock`, `change_price`, `adjust_stock` |
| Edit business profile and terms | N | Own | N | N | `update_business_profile` |
| Edit budget, alert switches and usual items | Own | N | N | N | `update_buyer_settings`, `set_usual_item`, `remove_usual_item` |
| Acknowledge a price change | Own | N | N | N | `ack_price_change` |
| See own notifications and mark read | Y | Y | Y | Y | RLS, `mark_notifications_read` |
| See the attention queue | N | N | All items | Only items assigned to them | `v_attention` view |
| Assign an attention item | N | N | Y | N | `assign_attention` |
| Mark an attention item handled | N | N | Y | Only items assigned to them | `mark_attention_handled` |
| Suspend or reactivate a supplier | N | N | Y | Y | `set_supplier_status` |
| See all orders, suppliers, buyers, users and operators | N | N | Y | Y (operator workload counts are shown to the lead only) | RLS `is_admin`, page code |
| Read the audit log | Rows about their business (via the database) | Own activity page | Y | Y | RLS on `audit_log` |
| Read stock history | N | Own products | Y | Y | RLS on `stock_movements` |
| Change theme | Y | Y | Y | Y | Browser cookie |

Note: the database lets a buyer read audit rows that involve their business. No buyer screen shows them.

---

## 5. Feature catalogue

Priority comes from the user story (Must or Should). Status: **Built**, **Partial** (built with gaps listed) or **Not built**.

| ID | Feature | Role | Priority | Status | Related user stories |
| --- | --- | --- | --- | --- | --- |
| F-01 | Sign in and sign out | All | Must | Built | AUTH-01, AUTH-02 |
| F-02 | Reset a forgotten password | All | Must | Built | AUTH-03 |
| F-03 | Create an account (self sign-up) | Buyer, supplier | Must | Built | AUTH-10 |
| F-04 | Role-based access and routing | All | Must | Built | AUTH-06, AUTH-09 |
| F-05 | Two-factor sign-in | All | Must, Should | Not built (removed by ADR 0024) | AUTH-04, AUTH-05, AUTH-08 |
| F-06 | Accept or decline an invitation | Supplier, buyer | Must | Not built | AUTH-07, SUP-20, SUP-21, ADM-15 |
| F-07 | App shell, navigation and responsive layout | All | Must | Built | SH-01, SH-04, SH-12 |
| F-08 | Home with Next up for every role | All | Must | Built | SH-02, BUY-01, BUY-02, BUY-03, BUY-04, BUY-07, BUY-08, BUY-09, SUP-01, SUP-02, ADM-01 |
| F-09 | Light, dark and system theme | All | Must | Built (remembered per browser, not per account) | SH-03 |
| F-10 | In-app notifications, bell panel and Alerts page | All | Must | Built | SH-09, ADM-08 |
| F-11 | Web push notifications | All | Should | Not built (code exists, nothing sends) | SH-09, SH-13 |
| F-12 | Offline page and app manifest | All | Should | Partial (no install prompt, no offline actions in the main app) | SH-07, SH-13 |
| F-13 | Loading, empty and error states | All | Must | Built | SH-05, SH-06 |
| F-14 | Audit log | Admin | Must | Built | SH-11, ADM-18 |
| F-15 | Tradelink AI assistant | Buyer, supplier | Must | Built | BUY-45, BUY-47, BUY-48, BUY-49, BUY-50, AI-04, AI-05 |
| F-16 | Order from typed text | Buyer | Must | Partial (through Tradelink AI tools; the rule-based fallback reader is not reachable) | BUY-10, BUY-11, AI-01, AI-02, AI-03 |
| F-17 | Usual items and "Place tomorrow's order" | Buyer | Must | Built | BUY-08, BUY-12, BUY-46 |
| F-18 | Browse products and add to cart | Buyer | Must | Built | BUY-13, BUY-42 |
| F-19 | Cart review and place orders | Buyer | Must | Built | BUY-14, BUY-15, BUY-16, BUY-17, BUY-20, BUY-22, BUY-23 |
| F-20 | Below-minimum warning | Buyer, supplier | Must | Built (warning only; negotiation not built) | BUY-24 |
| F-21 | Add a missing product | Buyer | Must | Built | BUY-18 |
| F-22 | Add a supplier not on Tradelink | Buyer, admin | Must | Partial (record and admin follow-up only; no invitation is sent) | BUY-19, ADM-06 |
| F-23 | Orders list and order page | Buyer | Must | Built (orders only; no invoices) | BUY-27 |
| F-24 | Cancel a pending order | Buyer | Must | Built | BUY-28 |
| F-25 | Delivery check: All here and Not here yet | Buyer | Must | Built | BUY-29, BUY-31 |
| F-26 | Report a problem | Buyer | Must | Built | BUY-30 |
| F-27 | Credits and confirming a credit arrived | Buyer, supplier | Must | Built | BUY-37 |
| F-28 | Invoices: upload, read, check, bank details, manual entry | Buyer, supplier | Must | Not built | BUY-05, BUY-06, BUY-26, BUY-32, BUY-33, BUY-34, BUY-35, BUY-36, SUP-19, AI-07 |
| F-29 | Insights | Buyer | Must, Should | Built | BUY-38, BUY-39, BUY-40, BUY-41 |
| F-30 | Buyer settings: budget, alerts and usual items | Buyer | Must | Built | BUY-43, BUY-44, BUY-46 |
| F-31 | Incoming orders: accept, part accept, reject | Supplier | Must | Built | SUP-03, SUP-04, SUP-05, SUP-06 |
| F-32 | Deliveries, including a second delivery for the rest | Supplier, buyer | Must | Built | SUP-07, BUY-21 |
| F-33 | Delivery date changes and order messages | Buyer, supplier | None (added after the stories) | Built | BUY-21 |
| F-34 | Answer problems | Supplier | Must | Built | SUP-09 |
| F-35 | Inventory: add product, receive, confirm, change price, adjust | Supplier | Must, Should | Built | SUP-10, SUP-11, SUP-12, SUP-13, SUP-14, SUP-15 |
| F-36 | Stock history and activity | Supplier | Must | Built | SUP-16, SUP-17, OPS-01 |
| F-37 | Supplier business profile | Supplier | Must | Built | SUP-18 |
| F-38 | Needs attention, with lead and operator visibility | Admin | Must | Built | ADM-02, ADM-03, ADM-04, ADM-05 |
| F-39 | Resolve a dispute | Admin | Must | Built | ADM-07 |
| F-40 | All orders, suppliers, low stock, users, buyers, operators | Admin | Must | Built (view only, except suspend and reactivate) | ADM-09, ADM-10, ADM-11, ADM-12, ADM-13, ADM-14, ADM-16, SUP-22 |
| F-41 | Admin settings | Admin | Must | Partial (account and appearance only) | ADM-19 |
| F-42 | System status page | Admin | Must | Not built (a liveness endpoint only) | ADM-17, OPS-05 |
| F-43 | Minimum-order negotiation and fees | Buyer, supplier | Must | Not built | BUY-25, SUP-08, AI-08 |
| F-44 | Team members | Buyer, supplier | Should | Not built | SH-14 |
| F-45 | Live updates | All | Should | Not built in the main app | SH-10 |
| F-46 | Connect a buyer and a supplier (admin) | Admin | Should | Not built | ADM-20 |
| F-47 | No overselling, idempotent actions, state machines | System | Must | Built | OPS-02, OPS-03, OPS-04 |
| F-48 | Rate limits | System | Must | Partial (AI chat and order messages only) | OPS-07 |
| F-49 | Demo data and accounts | System | Must | Built | OPS-08 |
| F-50 | Email delivery, retention jobs, CI, AI evaluation set, performance budget | System | Must, Should | Not built | OPS-09, OPS-10, OPS-11, OPS-12, AI-06 |

---

## 6. Functional requirements

Test references point to real files. "No automated test" means the behaviour is only checked by hand or by reading the code.

### 6.1 Accounts and access

| ID | Requirement | Role | Trigger | Expected behaviour | Acceptance criteria | Test reference |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | Sign in with email and password | All | Submit the sign-in form | The person lands on their role's home, or on the safe `next` path they came from | Wrong details show "Check your email and password."; too many tries show "Too many attempts. Try again in a few minutes." | `src/features/auth/routing.test.ts`, `e2e/smoke.spec.ts` |
| FR-002 | Sign out | All | Sign out in the account menu or Settings > Account | The session ends and the sign-in page shows | Opening a role page afterwards leads to sign-in | No automated test |
| FR-003 | Request a password reset | All | Submit an email on Forgot password | A reset email is requested from Supabase Auth; the page always says it was sent | The reply is the same whether the email exists or not | `src/features/auth/origin.test.ts` |
| FR-004 | Set a new password | All | Open the emailed link and submit the form | The password changes and the person is signed in | A password under 12 characters is refused with "Use at least 12 characters."; an expired link shows an expired notice | `src/features/auth/password.test.ts` |
| FR-005 | Create a buyer or supplier account | Not signed in | Submit Sign up (kind, business name, name, phone, email, password) | An active business, profile and membership are created; the business is connected to every active business of the other kind; admins get "New account" | A duplicate business name of the same kind is refused ("That business name may already be in use"); admin accounts cannot be created | `src/features/auth/signUp.test.ts` |
| FR-006 | Send each person to their own area | All | Open any page | Buyers stay under `/buyer`, suppliers under `/supplier`, admins under `/admin`; others are redirected and the attempt is logged as denied | A buyer opening `/admin` lands on `/buyer` | `src/features/auth/routing.test.ts` |
| FR-007 | Never redirect to another site after sign-in | All | Sign in with a `next` parameter | Only same-site paths are followed | `next=https://evil.example` lands on the role home | `src/features/auth/routing.test.ts` |

### 6.2 Shared app behaviour

| ID | Requirement | Role | Trigger | Expected behaviour | Acceptance criteria | Test reference |
| --- | --- | --- | --- | --- | --- | --- |
| FR-010 | Show role navigation | All | Any signed-in page | Laptop (760px and wider): sections in the top bar. Phone: bottom tabs, with a More sheet when a role has more than 5 sections. | Buyer: Home, Tradelink AI, Orders, Products, Insights. Supplier: Home, Tradelink AI, Orders, Inventory, Activity. Admin: Home, Attention, Orders, Suppliers, Users, Operators, Audit log. | `src/features/shell/nav.test.ts` |
| FR-011 | Show counts on navigation | All | Any signed-in page | Buyer Orders shows deliveries to check; supplier Orders shows new orders; supplier Inventory shows products to reorder; admin Attention shows visible items | Counts match the lists they lead to | `src/features/shell/nav.test.ts` |
| FR-012 | Switch theme | All | Top-bar toggle or Settings > Appearance (System, Light, Dark) | The theme changes at once and is remembered in this browser | Reloading keeps the choice; System follows the device | No automated test |
| FR-013 | Show in-app notifications | All | A database event for the person's business | A bell panel lists recent notifications with one action button each (for example Reply, Answer, Confirm credit, Check delivery) | The button opens the right order section (`#messages`, `#problems`) | `src/features/notifications/routes.test.ts` |
| FR-014 | Mark notifications read | All | Open Alerts and choose Mark all read | All of the business's notifications are marked read | The unread count drops to 0 | No automated test |
| FR-015 | Show empty and error states | All | A list with no rows, or a page that fails | A plain message and a next step; failures show "This page did not load" with Try again | No page shows a blank area or a stack trace | `e2e/pages.spec.ts` |
| FR-016 | Keep failed admin saves on the page | Admin | A save that cannot reach the server (for example a page opened before a deploy) | "This did not save. Reload the page and try again." appears under the control; the choice goes back to the saved value | The page stays usable | No automated test (checked by hand on 4 November 2026) |
| FR-017 | Show an offline page | All | The network fails while loading a page | The service worker serves `/offline` with Try again | Works with no network | `e2e/smoke.spec.ts` |
| FR-018 | Fit phone screens | All | Any page at phone width | No sideways scrolling | Every buyer and supplier page passes the overflow check | `e2e/pages.spec.ts` |

### 6.3 Buyer: ordering

| ID | Requirement | Role | Trigger | Expected behaviour | Acceptance criteria | Test reference |
| --- | --- | --- | --- | --- | --- | --- |
| FR-020 | Show what needs the buyer on Home | Buyer | Open Home | Next up shows one step at a time: tomorrow's order plan, deliveries to check, and to-dos (price changes, part deliveries, replies to problems, credits to confirm, date requests, messages) | With nothing to do: "Nothing needs you right now. Your usual items are covered and every delivery is checked." | `src/domain/todos.test.ts`, `src/domain/home.test.ts` |
| FR-021 | Suggest tomorrow's order | Buyer | Usual items running out within 3 days | A plan tops each item up to cover 7 days, limited by available stock; buttons Place orders, Review in cart, Not today | Not today hides the plan for the day; changing "in your shop" brings it back | `src/domain/reorder.test.ts`, `src/features/buyer/usual-days.test.ts` |
| FR-022 | Order through Tradelink AI | Buyer | Type a request such as "order 2 bags of rice" | The assistant finds products with its tools and shows a confirm card; nothing changes until the buyer taps it | No order is placed without a tap; unknown products are not invented | `src/features/ai/tools.test.ts` |
| FR-023 | Add usual items to an empty cart | Buyer | My usual on the empty cart | Usual items are added at their usual quantities | The cart shows them grouped by supplier | No automated test |
| FR-024 | Browse and filter products | Buyer | Open Products | Search, category and supplier filters; quantity to add to cart | "No products match your search and filters." when empty | `src/features/products/availability.test.ts`, `src/features/products/cart.test.ts` |
| FR-025 | Review the cart before placing | Buyer | Open Cart | Lines grouped by supplier with subtotals, cut-off notes, a "Checked:" line listing anything to fix, total before GST, and the budget after the order | Place is disabled while any line needs fixing | `src/features/ordering/cart-groups.test.ts`, `src/features/ordering/line-view.test.ts` |
| FR-026 | Warn about stock and offer a substitute | Buyer | A line asks for more than is available | The line is marked and offers a one-tap fix or "Use {product} instead" | The order cannot be placed for more than is available | `src/features/ordering/line-ops.test.ts`, `src/domain/reader/rules.test.ts` |
| FR-027 | Warn about a price rise | Buyer | A line's price is more than 2% above what the buyer last paid | The line shows "You last paid S$x" | No warning at 2% or less | `src/domain/review.test.ts`, `src/features/ordering/line-view.test.ts` |
| FR-028 | Warn when below a supplier's minimum | Buyer | A supplier's subtotal is under its minimum order | "Below {supplier}'s S$X minimum by S$Y." with usual items that would cover the gap; placing is still allowed | The order is flagged "Below minimum" for both sides | `src/domain/minimum.test.ts`, `src/features/supplier/minimum.test.ts` |
| FR-029 | Show cut-off and earliest delivery | Buyer | A supplier group in the cart | "Order by 16:00 for tomorrow" or "Past cut-off, earliest delivery is {day}", from cut-off, lead time and delivery days in Singapore time | The text changes when the cut-off passes | `src/domain/cutoff.test.ts` |
| FR-030 | Place orders and reserve stock | Buyer | Place N orders | One order per supplier is created, stock is reserved for active products, suppliers are notified, the cart is cleared | A shortfall stops everything and highlights the short lines; success shows "N orders placed and stock reserved." | `tests/concurrency/reservations.test.ts`, `e2e/order-flow.spec.ts` |
| FR-031 | Never place the same order twice | Buyer | Placing again with the same idempotency key (double tap, retry) | The stored result is returned and no second order is created | One order per supplier per placement | `tests/concurrency/reservations.test.ts` (stock), no test for the key itself |
| FR-032 | Add a missing product | Buyer | Add to catalogue in the cart, or the Tradelink AI form card | An unconfirmed product is created for a connected supplier with stock 0; the supplier is notified ("Product added") | The line waits for the supplier to confirm; a duplicate name is refused | No automated test |
| FR-033 | Add a supplier not on Tradelink | Buyer | The Tradelink AI "new supplier" form card | An invited business and connection are created; products can then be added for it | No email or message is sent to the supplier; admins see a follow-up after 24 hours | `src/features/ai/tools.test.ts` |

### 6.4 Buyer: orders and after delivery

| ID | Requirement | Role | Trigger | Expected behaviour | Acceptance criteria | Test reference |
| --- | --- | --- | --- | --- | --- | --- |
| FR-040 | List and filter orders | Buyer | Open Orders | Filters All, Active, To check, Delivered, Problems, Cancelled and rejected; search by order number or supplier | Banners show credits to confirm and problems waiting | `src/features/buyer/orders/filters.test.ts`, `src/features/buyer/orders/summary.test.ts` |
| FR-041 | Show an order's progress | Buyer | Open an order | Progress (Placed, Accepted, Out for delivery, Delivered), items, delivery dates, the rest of a two-part delivery, problems and the conversation | Every status has a word, not only a colour | `e2e/pages.spec.ts` |
| FR-042 | Cancel a pending order | Buyer | Cancel order | The order is cancelled, held stock is released, the supplier is notified | Not possible once accepted | No automated test |
| FR-043 | Confirm All here | Buyer | All here on a delivered or out-for-delivery order | The order is marked delivered if needed, then checked; usual "in shop" amounts go up | The order leaves "To check" | No automated test |
| FR-044 | Report Not here yet | Buyer | Not here yet on an order out for delivery | A late problem is opened and the supplier is notified | A second open late report shows "already reported" | No automated test |
| FR-045 | Report a problem on a delivered line | Buyer | Report a problem (type, quantity, note) | A problem opens with amount = quantity × unit price; the supplier is notified | Types: short, damaged, wrong item, expired; the note is at most 500 characters | `e2e/order-flow.spec.ts` |
| FR-046 | Confirm a credit arrived | Buyer | Mark credit received on a problem with a promised credit | The problem moves to credit received; the supplier is told | A promised credit stays open until the buyer confirms it | `e2e/order-flow.spec.ts`, `src/features/buyer/orders/summary.test.ts`, `src/features/notifications/routes.test.ts` |
| FR-047 | Handle a part-accepted order | Buyer | The supplier sends less | The order page says what the supplier cannot send; with a later date, "The rest comes {date}" | The buyer can cancel the rest while it is waiting | `src/domain/todos.test.ts` |
| FR-048 | Ask to move a delivery date | Buyer, supplier | Request a new date on an order (first delivery or the rest) | The other side gets a request with Accept and Decline; a new request replaces an open one for the same part | Only the other side can answer; accepting moves the date | `src/features/ai/tools.test.ts` |
| FR-049 | Send an order message | Buyer, supplier | Send a message on an order | The other side is notified with a Reply button | At most 30 messages per person per hour | No automated test |

### 6.5 Buyer: insights and settings

| ID | Requirement | Role | Trigger | Expected behaviour | Acceptance criteria | Test reference |
| --- | --- | --- | --- | --- | --- | --- |
| FR-050 | Summarise spending | Buyer | Open Insights | An "In short" line, figures (spent this week, last week, budget, left, overcharges caught, price changes), a 5-week spend chart, spend by supplier, on-time record, price changes | Rejected and cancelled orders never count as spend | `src/domain/insights.test.ts`, `src/features/insights/summary.test.ts` |
| FR-051 | Track the weekly budget | Buyer | Home and Cart | Spend so far, the pace to Sunday and the budget after the order | Good below 75% used, warning from 75%, over budget above 100% | `src/domain/insights.test.ts`, `src/domain/home.test.ts` |
| FR-052 | Edit budget and alerts | Buyer | Settings > Budget and alerts | Weekly budget and three switches: suggest what to reorder, tell me about price changes, warn me before I go over budget | Budget must be above 0 | No automated test |
| FR-053 | Edit usual items | Buyer | Settings > Usual items | Usual order quantity, amount in the shop and use per day per product; remove | Days left update from these numbers | `src/features/buyer/usual-days.test.ts` |
| FR-054 | Acknowledge a price change | Buyer | A price change to-do on Home | The to-do is cleared for this business | It does not come back | `src/domain/todos.test.ts` |

### 6.6 Supplier

| ID | Requirement | Role | Trigger | Expected behaviour | Acceptance criteria | Test reference |
| --- | --- | --- | --- | --- | --- | --- |
| FR-060 | Show what needs the supplier on Home | Supplier | Open Home | Next up: accept new orders, pack today's orders (one pick list added up across orders), answer problems, receive stock, quiet customers; a cut-off countdown and today against a usual weekday | Each step links to the page that does it | `src/domain/home.test.ts` |
| FR-061 | List incoming orders | Supplier | Open Orders | Tabs New, To pack, Out for delivery, Delivered, All; tiles; search | "Below minimum" pill on orders under the supplier's minimum | `src/features/supplier/orderFilters.test.ts` |
| FR-062 | Accept an order | Supplier | Accept order with a delivery date | Stock is reserved for any lines not held yet, those lines are repriced at today's price, the order becomes accepted, the buyer is notified | The date must be today or later; products a buyer added must be confirmed first; a shortfall is refused | `src/features/supplier/dates.test.ts`, `e2e/order-flow.spec.ts` |
| FR-063 | Part accept an order | Supplier | Part accept with a quantity per line | Unsent stock is released. Without a later date, the missing amount is dropped and the buyer gets a to-do. With a later date, the rest is kept as a second delivery (not reserved). | Sending nothing is a rejection, or an error if a later date was given | No automated test |
| FR-064 | Reject an order | Supplier | Reject order | Held stock is released and the buyer is notified | Only while pending | No automated test |
| FR-065 | Deliver an order | Supplier | Mark out for delivery, then Mark delivered | Stock leaves on hand and reserved together; the buyer is notified each time | Works for a suspended supplier finishing accepted orders | `e2e/order-flow.spec.ts` |
| FR-066 | Deliver the rest | Supplier | Mark the rest out for delivery, then Deliver the rest | The rest is taken from free stock and added to the delivered quantities; the buyer checks again | Refused with "not in stock" when free stock is short | No automated test |
| FR-067 | Answer a problem | Supplier | Choose Credit, Replace next delivery, It is on the way (late only) or Dispute | The problem moves to the matching status and the buyer is notified; a dispute also alerts admins | Credit needs an amount above 0; Replace is not offered for late problems | `src/features/supplier/issues.test.ts`, `e2e/order-flow.spec.ts` |
| FR-068 | Add a product | Supplier | Add product (name, unit, price, opening stock, reorder level, category) | The product is active with its opening stock recorded as received | Price above 0 and at most 99,999; duplicate names refused | `src/features/supplier/product.test.ts`, `src/features/supplier/validation.test.ts` |
| FR-069 | Receive stock | Supplier | Receive stock with a quantity | On hand goes up and a received movement is recorded; an unconfirmed product becomes active | Quantity must be positive | `src/features/supplier/stock.test.ts` |
| FR-070 | Confirm a product a buyer added | Supplier | Confirm stock (quantity, price, reorder level) | The product becomes active and can be accepted on orders | Only for unconfirmed products | `src/features/supplier/stock.test.ts` |
| FR-071 | Change a price | Supplier | Change price | The new price applies to new orders; a price change is recorded when it differs | Connected buyers with the item as usual see a to-do | `src/features/supplier/validation.test.ts` |
| FR-072 | Adjust stock | Supplier | Adjust stock with a change, reason (damaged, expired, count correction) and note | On hand changes and an adjusted movement is recorded | Refused if on hand would fall below reserved; change between -9,999 and 9,999, not 0 | `src/features/supplier/stock.test.ts` |
| FR-073 | See stock history | Supplier | Open Stock history | The latest 200 movements, filterable by type | Every stock change appears | No automated test |
| FR-074 | See activity | Supplier | Open Activity | The latest 200 audit entries about the business, by day, filterable (order, stock, account) | Newest first | `src/features/supplier/activity.test.ts` |
| FR-075 | Edit business profile and terms | Supplier | Settings > Business profile | Contact details, product range, delivery days, lead time (0 to 14 days), cut-off and minimum order are saved | Buyers' cut-off and minimum messages follow the new values | `src/features/supplier/profile.test.ts` |

### 6.7 Admin

| ID | Requirement | Role | Trigger | Expected behaviour | Acceptance criteria | Test reference |
| --- | --- | --- | --- | --- | --- | --- |
| FR-080 | Show the attention queue | Admin | Open Attention | Items derived from 8 rules (section 8), high priority first then oldest; filters All, High, Medium, and Unassigned for the lead | The lead sees all items; an operator sees only items assigned to them | `src/features/admin/attention.test.ts` |
| FR-081 | Show the newest urgent items on Home | Admin | Open Home | Next up shows 4 items, high priority and newest first, and "See all {n} in Attention" | The link opens the Attention page | No automated test |
| FR-082 | Assign an item | Admin lead | Choose an operator in Assigned to | The item is assigned and stays shown after saving | Operators see "Assigned to you" instead of the choice; an operator calling the function is refused | `src/features/admin/attention.test.ts` |
| FR-083 | Mark an item handled | Admin | Mark handled (blocked-action items) | The item is hidden until its cause happens again | Operators can only handle items assigned to them; other items clear when their cause is fixed | `src/features/admin/attention.test.ts` |
| FR-084 | Resolve a dispute | Admin | Credit buyer or Close, no credit | Credit moves the problem to credit promised; close closes it; both sides are notified | Only for disputed problems | No automated test |
| FR-085 | Suspend or reactivate a supplier | Admin | Suspend (with confirmation) or Reactivate | Suspending cancels pending orders, releases their stock, hides the supplier's products from new orders and notifies the supplier and its buyers | A suspended supplier can still deliver accepted orders | No automated test |
| FR-086 | View orders, suppliers, buyers, users and operators | Admin | Open each page | Read-only lists with filters and search; operator presence (Online within 5 minutes, Away within 30, else Offline) | Operator workload counts appear only for the lead | `src/features/admin/orderStats.test.ts`, `src/features/admin/presence.test.ts`, `src/features/admin/params.test.ts` |
| FR-087 | Read the audit log | Admin | Open Audit log | 30 entries per page, filter by organisation (who made the change) and outcome (Allowed, Blocked) | Entries cannot be edited or deleted | `src/features/admin/params.test.ts` |

### 6.8 Tradelink AI

| ID | Requirement | Role | Trigger | Expected behaviour | Acceptance criteria | Test reference |
| --- | --- | --- | --- | --- | --- | --- |
| FR-090 | Answer from the person's own data | Buyer, supplier | Ask a question | The assistant uses read tools that run as the signed-in person, so it sees only what they can see | Facts come only from tool results; unknown facts are said to be unknown | `src/features/ai/tools.test.ts` |
| FR-091 | Change data only after a tap | Buyer, supplier | A request that changes something | A confirm card describes the change; the change runs only when the person taps it, and is checked again on the server | No write happens from the model alone | `src/features/ai/tools.test.ts` |
| FR-092 | Show working cards | Buyer, supplier | Answers about orders, products, stock, problems or spend | Cards with their own buttons appear in the reply, at most 5 | Tags that tools did not return are not drawn | `src/features/ai/ui/reply-blocks.test.ts` |
| FR-093 | Stay available and safe under failure | Buyer, supplier | Claude is not configured, slow or failing | "Tradelink AI is not set up yet." or "Tradelink AI is not available right now…" | No partial changes; the rest of the app keeps working | No automated test |
| FR-094 | Limit use | Buyer, supplier | More than 60 messages in an hour | The request is refused with a rate-limit message | Counted per person | No automated test |
| FR-095 | Keep conversations | Buyer, supplier | Reopen Tradelink AI | Past conversations are listed and reopen scrolled to the latest message | Stored in this browser only | `src/features/ask/history.test.ts` |
| FR-096 | Use the assistant on an order page | Buyer, supplier | The chat panel on an order | The assistant gets that order's facts, including why it is flagged (for example below minimum) | Answers refer to that order | No automated test |

---

## 7. User journeys

### J-01 Ordering (buyer)

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Buyer | Opens Home | Shows "Place tomorrow's order" when usual items run low | No usual items: no plan; the buyer uses Tradelink AI or Products |
| 2 | Buyer | Taps Review in cart, types to Tradelink AI, or adds from Products | Lines are added to the cart; Tradelink AI shows a confirm card first | Tradelink AI unavailable: the buyer uses Products and the cart |
| 3 | Buyer | Opens the cart | Groups by supplier; shows the Checked line, cut-offs, below-minimum warnings, budget after order | Lines over stock or unmatched block placing until fixed |
| 4 | Buyer | Taps Place N orders | Locks stock, creates one order per supplier, reserves stock, notifies suppliers | Another buyer took the stock: STOCK_SHORT, short lines highlighted, nothing placed |
| 5 | Supplier | Receives "New order" | Order appears under New | — |

### J-02 Supplier fulfilment

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Supplier | Opens a new order | Shows lines, stock, the below-minimum flag and products a buyer added | — |
| 2a | Supplier | Accept order with a date | Reserves any unheld lines, reprices them, status Accepted, buyer notified | Date in the past refused; unconfirmed products must be confirmed first; stock short refused |
| 2b | Supplier | Part accept, now only | Releases unsent stock, removes the missing amount, buyer gets a to-do | Sending nothing equals a rejection |
| 2c | Supplier | Part accept with a later date | Keeps the rest as a second delivery (not reserved) | Sending nothing now with a later date is refused |
| 2d | Supplier | Reject | Releases stock, buyer notified | Only while pending |
| 3 | Supplier | Mark out for delivery, then Mark delivered | Buyer notified each time; stock leaves on hand and reserved | — |
| 4 | Supplier | Mark the rest out for delivery, then Deliver the rest | Rest taken from free stock; buyer checks again | Free stock short: "not in stock"; see BUG-01 in section 18 |
| 5 | Either | Ask to move a date or send a message | Other side notified with Answer or Reply | Only the other side can answer a date request |

### J-03 Delivery problems and credits

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Buyer | Taps All here | Order checked; done | — |
| 1b | Buyer | Taps Not here yet (out for delivery) | Late problem opened; supplier notified | Already reported: refused |
| 2 | Buyer | Reports a problem on a line | Problem opened with amount; supplier notified | Order out for delivery: marked delivered first |
| 3 | Supplier | Answers: credit, replace, on the way or dispute | Status changes; buyer notified; dispute alerts admins | Credit needs an amount above 0 |
| 4 | Buyer | Taps Confirm credit when the credit arrives | Status credit received; supplier told | Until then the problem stays open as "Confirm credit" |

### J-04 Invoice checks — Not built

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| — | — | — | There is no invoice upload, reading or check. The `invoice` problem type cannot be created. | See section 18 |

### J-05 Adding a supplier who is not on Tradelink (the built part of supplier invitations)

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Buyer | Asks Tradelink AI to add a supplier, or a product from a new supplier | A form card appears | — |
| 2 | Buyer | Taps the card's button | An invited business, empty supplier profile and invited connection are created; reply says Tradelink will invite them | Name already connected or listed: refused as a duplicate |
| 3 | Buyer | Adds products for that supplier and orders them | Cart lines note "Waits for the supplier to accept your invitation" | — |
| 4 | System | After 24 hours | An admin attention item "{supplier} has not joined" | — |
| 5 | Admin lead | Assigns the item | The operator sees it | No action can contact or activate the supplier |
| 6 | Supplier | Signs up under the same business name | Refused as a duplicate | Dead end; see BUG-02 in section 18 |

### J-06 Disputes

| Step | Actor | Action | System response | Exception |
| --- | --- | --- | --- | --- |
| 1 | Supplier | Answers a problem with Dispute | Status Disputed; buyer sees "Under review"; admins get "Dispute opened" | — |
| 2 | System | — | High-priority attention item "Dispute on ORD-x" with both businesses, type, amount and note | — |
| 3 | Admin lead | Assigns it, or handles it | Assigned operator sees it | — |
| 4 | Admin | Credit buyer, or Close, no credit | Credit promised or Closed; both sides notified | Only for disputed problems |
| 5 | Buyer | Confirms the credit when it arrives (if credited) | Credit received | — |

---

## 8. Business rules

| ID | Rule | Applies to | Reason |
| --- | --- | --- | --- |
| BR-001 | Money is stored as integer cents in the app and `numeric(12,2)` in the database; amounts show as S$ with two decimals | All amounts | Avoid rounding errors ([ADR 0019](../adr/0019-money-time-and-quantities.md)) |
| BR-002 | Dates, cut-offs and weeks use Singapore time (Asia/Singapore); weeks run Monday to Sunday | All dates | All businesses are in Singapore (ADR 0019) |
| BR-003 | One person belongs to one business; the business kind decides the role | Accounts | Simple tenancy ([ADR 0005](../adr/0005-tenancy-and-connections.md)) |
| BR-004 | A new account is connected to every active business of the other kind | Sign-up | A new account can trade at once (ADR 0024) |
| BR-005 | Business names are unique per kind, including invited businesses | Sign-up, adding a supplier | Prevent duplicates |
| BR-006 | Passwords need at least 12 characters | Sign-up, reset | [ADR 0011](../adr/0011-authentication-and-invitations.md) |
| BR-007 | Buyers see products only from suppliers they trade with (plus products on their own orders) | Products | Tenancy (ADR 0005) |
| BR-008 | A cart holds at most 60 lines | Cart | Keep orders reviewable |
| BR-009 | Placing creates one order per supplier | Ordering | Each supplier handles its own order |
| BR-010 | Available stock = on hand − reserved; an order cannot take more than is available | Ordering, accepting | No overselling ([ADR 0006](../adr/0006-inventory-history-and-reservations.md)) |
| BR-011 | Stock for active products is reserved when the order is placed; stock for products a buyer added is reserved when the supplier accepts | Ordering | The supplier has not confirmed unconfirmed stock (ADR 0006) |
| BR-012 | Below a supplier's minimum order the buyer is warned but never blocked; the order is flagged "Below minimum" | Ordering | Decision D5 ([ADR 0020](../adr/0020-minimum-order-negotiation.md)) |
| BR-013 | A line priced more than 2% above what the buyer last paid shows a warning | Cart | BUY-17 |
| BR-014 | The reorder plan includes usual items with fewer than 3 days left and tops them up to cover 7 days, limited by available stock | Home | DISCOVERY 6.3 |
| BR-015 | The weekly budget defaults to S$900; use is "good" below 75%, "warning" from 75% to 100%, "over" above | Budget | — |
| BR-016 | A buyer can cancel only while the order is pending | Orders | After acceptance the supplier has committed stock |
| BR-017 | The supplier's delivery date must be today or later | Accepting | — |
| BR-018 | Products a buyer added must be confirmed by the supplier before the order can be accepted | Accepting | CONFIRM_STOCK_FIRST |
| BR-019 | Accepting reprices lines that were not held at the supplier's current price | Accepting | Unconfirmed products had no agreed price |
| BR-020 | In a part accept, each line sends 0 up to the ordered quantity; sending nothing at all is a rejection | Part accept | — |
| BR-021 | The rest of a two-part delivery is not reserved; it is taken from free stock when delivered | Second delivery | Stock may arrive later |
| BR-022 | Only the side that did not ask can answer a date request; a new request for the same part replaces the open one | Date changes | — |
| BR-023 | The rest can be cancelled only while it is waiting | Second delivery | — |
| BR-024 | Each person can send at most 30 order messages per hour | Messages | Abuse protection ([ADR 0014](../adr/0014-rate-limiting-in-postgres.md)) |
| BR-025 | Problems can be reported only on delivered lines; reporting on an order out for delivery marks it delivered first | Problems | — |
| BR-026 | A problem's amount = quantity × unit price | Problems | — |
| BR-027 | Only one open "late" problem per order | Not here yet | — |
| BR-028 | Credit needs an amount above 0; "Replace next delivery" is not offered for late or invoice problems; "It is on the way" is only for late problems | Answers | — |
| BR-029 | A promised credit stays open until the buyer confirms it arrived | Credits | Owner request, 4 November 2026 |
| BR-030 | Only admins resolve disputes, by credit or close | Disputes | — |
| BR-031 | Stock can only be adjusted with a reason, by −9,999 to 9,999 and not 0, and never below reserved | Inventory | BELOW_RESERVED (ADR 0006) |
| BR-032 | Prices are above 0 and at most 99,999; a price change is recorded only when the price differs | Inventory | — |
| BR-033 | Suspending a supplier cancels its pending orders, releases their stock and hides it from new orders; accepted orders can still be delivered | Admin | Buyers are not left waiting on a suspended supplier |
| BR-034 | Attention items come from 8 rules: supplier invited more than 24 hours ago (medium), dispute (high), problem open more than 4 hours (medium), product out of stock (high), order pending more than 30 minutes (medium), buyer-added product not confirmed (medium), product at or below reorder level (medium), blocked action (medium) | Admin | Derived items clear themselves when the cause is fixed ([ADR 0013](../adr/0013-scheduled-jobs-and-derived-attention.md)) |
| BR-035 | The operations lead sees and assigns every attention item; other operators see only items assigned to them | Admin | Owner request, 4 November 2026 |
| BR-036 | "Mark handled" hides an item until its cause occurs again; operators can only handle their own items | Admin | — |
| BR-037 | Tradelink AI changes data only after the person taps a confirm card or a card button, and the change runs as that person | AI | AI must not act on its own ([ADR 0008](../adr/0008-claude-integration.md), [ADR 0010](../adr/0010-untrusted-content-and-prompt-injection.md)) |
| BR-038 | Tradelink AI allows 60 messages per person per hour | AI | Cost and abuse control |
| BR-039 | The audit log, stock history, price changes and order events cannot be changed or deleted | Records | Trustworthy history (ADR 0006) |
| BR-040 | Every important action writes an audit entry; refused actions are logged as "denied" | Records | SH-11 |
| BR-041 | Critical actions carry an idempotency key, so a retry returns the first result | Writes | OPS-03 ([ADR 0004](../adr/0004-writes-through-postgres-functions.md)) |
| BR-042 | Order numbers start at ORD-1044 and problem numbers at ISS-302 | Records | Continue from the prototype's numbering (Inferred rationale) |

---

## 9. State models

### 9.1 Orders

| Current state | Event | Next state | Allowed by | Side effects |
| --- | --- | --- | --- | --- |
| (none) | Place orders | Pending | Buyer | Stock reserved for active products; supplier notified "New order" |
| Pending | Accept or part accept | Accepted | Supplier | Unheld lines reserved and repriced; buyer notified |
| Pending | Reject (or part accept sending nothing) | Rejected | Supplier | Held stock released; buyer notified |
| Pending | Cancel order | Cancelled | Buyer | Held stock released; supplier notified |
| Pending | Supplier suspended | Cancelled | Admin | Held stock released; both sides notified |
| Accepted | Mark out for delivery | Out for delivery | Supplier | Buyer notified |
| Out for delivery | Mark delivered, All here, or a problem report | Delivered | Supplier or buyer | Stock leaves on hand and reserved; buyer notified on Mark delivered |
| Delivered, Rejected, Cancelled | — | — | — | End states |

Delivery check (on delivered orders): Unchecked → All here (buyer) or Problem (buyer reports). Delivering the rest sets it back to Unchecked.

### 9.2 Second delivery ("the rest")

| Current state | Event | Next state | Allowed by | Side effects |
| --- | --- | --- | --- | --- |
| (none) | Part accept with a later date | Waiting | Supplier | Rest quantities recorded, not reserved; buyer notified |
| Waiting | Mark the rest out for delivery | Out for delivery | Supplier | Buyer notified |
| Waiting or Out for delivery | Deliver the rest | Delivered | Supplier | Stock taken from free stock; quantities merged; delivery check reset |
| Waiting | Cancel the rest | Cancelled | Buyer or supplier | Open date requests for the rest withdrawn; other side notified |

### 9.3 Problems (issues)

| Current state | Event | Next state | Allowed by | Side effects |
| --- | --- | --- | --- | --- |
| (none) | Report a problem or Not here yet | Open | Buyer | Supplier notified |
| Open | Credit | Credit promised | Supplier | Buyer notified with Confirm credit |
| Open | Replace next delivery | Replacement promised | Supplier | Buyer notified |
| Open (late only) | It is on the way | Supplier replied | Supplier | Buyer notified |
| Open | Dispute | Disputed | Supplier | Buyer notified; admins get "Dispute opened" |
| Disputed | Credit buyer | Credit promised | Admin | Both sides notified |
| Disputed | Close, no credit | Closed | Admin | Both sides notified |
| Credit promised | Mark credit received | Credit received | Buyer | Supplier notified |
| Replacement promised, Supplier replied, Closed, Credit received | — | — | — | End states |

### 9.4 Invoices — Not built

| Current state | Event | Next state | Allowed by | Side effects |
| --- | --- | --- | --- | --- |
| — | — | — | — | No invoice entity exists. See section 18. |

### 9.5 Invitations (invited businesses)

| Current state | Event | Next state | Allowed by | Side effects |
| --- | --- | --- | --- | --- |
| (none) | Buyer adds a supplier not on Tradelink | Invited | Buyer | Invited connection created; audit entry; no message sent |
| Invited | 24 hours pass | Invited | System | Admin attention item |
| Invited | Accept or decline | Active or Declined | — | **Not built.** The database allows these moves but no function performs them. |

### 9.6 Suppliers

| Current state | Event | Next state | Allowed by | Side effects |
| --- | --- | --- | --- | --- |
| (none) | Sign-up | Active | Supplier | Connected to every active buyer; admins notified |
| Active | Suspend | Suspended | Admin | Pending orders cancelled and stock released; products hidden from new orders; supplier and buyers notified |
| Suspended | Reactivate | Active | Admin | Supplier and buyers notified |

### 9.7 Delivery date requests

| Current state | Event | Next state | Allowed by | Side effects |
| --- | --- | --- | --- | --- |
| (none) | Ask to move a date | Open | Buyer or supplier | Other side notified ("Date change") |
| Open | Accept | Accepted | The other side | The delivery date moves; asker notified |
| Open | Decline | Declined | The other side | Asker notified |
| Open | A new request for the same part, or the rest is cancelled | Withdrawn | Either side | — |

### 9.8 Products

| Current state | Event | Next state | Allowed by | Side effects |
| --- | --- | --- | --- | --- |
| (none) | Supplier adds a product | Active | Supplier | Opening stock recorded |
| (none) | Buyer adds a product | Unconfirmed | Buyer | Supplier notified "Product added"; stock 0 |
| Unconfirmed | Confirm stock or Receive stock | Active | Supplier | Stock recorded |

---

## 10. Screen specification

| Screen | Role | Purpose | Main content | Actions | Empty or error state |
| --- | --- | --- | --- | --- | --- |
| SCR-01 Sign in (`/sign-in`) | Public | Sign in | Email, password | Sign in; links to Create an account and Forgot password | Wrong details, too many attempts, confirm email first, link expired |
| SCR-02 Create an account (`/sign-up`) | Public | Self sign-up | Kind, business name, name, phone, email, password, confirm | Create account | Field errors; duplicate business name; "Check your email to confirm your account" |
| SCR-03 Forgot password (`/forgot-password`) | Public | Request a reset | Email | Send link | Always shows "sent"; expired-link notice |
| SCR-04 Reset password (`/reset-password`) | Public | Set a new password | New password, confirm | Save | Under 12 characters; expired link |
| SCR-05 Offline (`/offline`) | All | Shown with no network | Title and message | Try again | — |
| SCR-10 Buyer Home (`/buyer`) | Buyer | What needs the buyer now | Greeting, ask bar, Next up, This week card, glance tabs (Deliveries, Running low, Prices) | Place orders, Review in cart, Not today, Check delivery, to-do actions | "Nothing needs you right now…" |
| SCR-11 Tradelink AI (`/buyer/assistant`) | Buyer | Ask and act through the assistant | Conversation list, chat, cards, confirm cards | Send, Confirm, card buttons, suggested follow-ups | "Tradelink AI is not set up yet." / "…not available right now" |
| SCR-12 Cart (`/buyer/cart`) | Buyer | Review and place | Lines by supplier, Checked line, cut-offs, below-minimum, totals, budget bar | Change quantity, swap, remove, Add to catalogue, Place N orders | "Your cart is empty" with My usual and Browse products |
| SCR-13 Products (`/buyer/products`) | Buyer | Browse and add | Search, category and supplier filters, product grid | Add to cart | "No products match your search and filters." |
| SCR-14 Orders (`/buyer/orders`) | Buyer | Track orders | Filter chips, search, order list with pills, banners | Open order | Per-filter empty text |
| SCR-15 Order (`/buyer/orders/[id]`) | Buyer | One order | Progress, items, dates, the rest, problems, conversation, AI panel | Cancel order, Not here yet, All here, Report a problem, Confirm credit, Cancel the rest, date request, message | Not found |
| SCR-16 Insights (`/buyer/insights`) | Buyer | Spending | In short, figures, chart, by supplier, on-time, price changes | None (read only) | Empty sections say there is no data yet |
| SCR-17 Alerts (`/buyer/notifications`) | Buyer | All notifications | Tabs All, Needs action, Updates | Mark all read, action buttons | "No updates yet. Changes to your orders show here." |
| SCR-18 Buyer settings (`/buyer/settings`) | Buyer | Budget, alerts, usual items, suppliers, account, theme | Cards per section | Save budget and switches, edit usual items, Sign out, theme | "You have no usual items yet…", "No suppliers connected yet." |
| SCR-20 Supplier Home (`/supplier`) | Supplier | What needs the supplier now | Cut-off countdown, Next up, today against a usual weekday, glance tabs (Customers, Running low, Coming up) | Mark all out for delivery, step links | Per-tab empty text |
| SCR-21 Tradelink AI (`/supplier/assistant`) | Supplier | Ask and act | As SCR-11 with supplier tools | As SCR-11 | As SCR-11 |
| SCR-22 Orders (`/supplier/orders`) | Supplier | Incoming orders | Tabs, tiles, search, list or table | Open order | Per-tab empty text |
| SCR-23 Order (`/supplier/orders/[id]`) | Supplier | Act on one order | Lines, buyer-added products, problems, the rest, conversation | Accept, Part accept, Reject, Out for delivery, Delivered, rest actions, Confirm stock, answer problems, date request, message | Not found |
| SCR-24 Inventory (`/supplier/inventory`) | Supplier | Stock and prices | Tiles, filters (All, Low, Out, To confirm), product list | Add product, Receive stock, Confirm stock, Change price, Adjust stock | Per-filter empty text |
| SCR-25 Stock history (`/supplier/stock-history`) | Supplier | Movements | Type filter, latest 200 | None | "No stock changes yet." |
| SCR-26 Activity (`/supplier/activity`) | Supplier | Audit feed | Filters, grouped by day | None | "No activity yet." |
| SCR-27 Alerts (`/supplier/notifications`) | Supplier | Notifications | List | Mark all read | "No notifications yet." |
| SCR-28 Supplier settings (`/supplier/settings`) | Supplier | Business profile, account, theme | Profile form | Save, Sign out, theme | Field errors |
| SCR-30 Admin Home (`/admin`) | Admin | What needs attention | Greeting, Next up (4 items), See all link, tiles, glance tabs (Activity, Low stock, Team online) | Open the queue | Lead: "Nothing needs attention…"; operator: "Nothing is assigned to you…" |
| SCR-31 Needs attention (`/admin/attention`) | Admin | Work queue | Filters, rows with priority, Assigned to, actions | Assign (lead), Mark handled, Credit buyer, Close no credit, View supplier, Open audit log | Per-filter empty text; operator: "Nothing is assigned to you right now." |
| SCR-32 All orders (`/admin/orders`) | Admin | Oversight | Status filters, search, tiles | None (read only) | "No orders yet." |
| SCR-33 Suppliers (`/admin/suppliers`) | Admin | Supplier list | Status filters, list, side panel on laptop | Open supplier, Suspend, Reactivate | "No suppliers yet." |
| SCR-34 Supplier profile (`/admin/suppliers/[id]`) | Admin | One supplier | Profile, products, orders | Suspend, Reactivate | Not found |
| SCR-35 Low stock (`/admin/suppliers/low-stock`) | Admin | Products at or below reorder level | List | None | "All products are above their reorder level." |
| SCR-36 Users (`/admin/users`) | Admin | Buyers and all accounts | Tabs, search | Open buyer | Empty text |
| SCR-37 Buyer details (`/admin/users/buyers/[id]`) | Admin | One buyer | Details, stats, orders | None | Not found |
| SCR-38 Operators (`/admin/operators`) | Admin | Team presence | Presence filter, team, shift, assigned items (lead only) | None | "No operators yet." |
| SCR-39 Audit log (`/admin/audit`) | Admin | Change history | Organisation and outcome filters, 30 per page | Show entries, Clear filters, page links | "No entries match these filters." |
| SCR-40 Alerts (`/admin/notifications`) | Admin | Notifications | List | Mark all read | Empty text |
| SCR-41 Admin settings (`/admin/settings`) | Admin | Account and theme | Account card, Appearance | Sign out, theme | — |

Redirects: `/buyer/ask` → SCR-11; `/buyer/availability` → SCR-13; `/buyer/order` → SCR-12 or SCR-11; `/buyer/issues/[id]` and `/supplier/issues/[id]` → the order's Problems section.

---

## 11. Notifications

All notifications are in-app (bell panel and Alerts page). There is no email, SMS or push.

| Event | Recipient | Channel | Message (kind) | Action |
| --- | --- | --- | --- | --- |
| Orders placed | Supplier | In-app | New order | Review order |
| Order accepted | Buyer | In-app | Order accepted | Open |
| Order part accepted | Buyer | In-app | Order part accepted | See changes |
| Order rejected | Buyer | In-app | Order rejected | Open |
| Order cancelled by buyer, or by a supplier suspension | Supplier, buyers | In-app | Order cancelled | Open |
| Out for delivery (first delivery or the rest) | Buyer | In-app | Out for delivery | Open |
| Delivered (first delivery or the rest) | Buyer | In-app | Order delivered | Check delivery |
| The rest cancelled | The other side | In-app | Order changed | Open |
| Date change asked or answered | The other side | In-app | Date change | Answer (when asked), else View order |
| Order message | The other side | In-app | Message | Reply |
| Problem reported | Supplier | In-app | Problem reported | Answer |
| Not here yet | Supplier | In-app | Delivery late | Open |
| Problem answered | Buyer | In-app | Problem answered | Confirm credit (credit promised), else View order |
| Dispute opened | Admins | In-app | Dispute opened | Open |
| Dispute resolved | Buyer and supplier | In-app | Dispute resolved | Open |
| Credit received | Supplier | In-app | Credit received | View order |
| Buyer added a product | Supplier | In-app | Product added | Open (Inventory) |
| Supplier suspended or reactivated | Supplier | In-app | Account suspended / Account reactivated | Open |
| Supplier suspended or reactivated | Connected buyers | In-app | Supplier suspended / Supplier reactivated | Open |
| New account signed up | Admins | In-app | New account | Open |

Buyers also see to-dos on Home and in the Alerts "Needs action" tab, built from the data rather than from notifications (price changes, part deliveries, replies, credits to confirm, date requests, unanswered messages).

---

## 12. AI behaviour

Tradelink AI is one assistant, powered by Claude (default model `claude-sonnet-5-5`, set with `ANTHROPIC_MODEL`). It runs on the server, as the signed-in person.

| Capability | Input | Output | User control | Failure handling | Limits |
| --- | --- | --- | --- | --- | --- |
| Answer questions about the person's business | A typed message and up to 20 earlier turns | One or two short sentences plus working cards | Read only | "Tradelink AI is not available right now…" | 60 messages per hour; 6 tool rounds per message; 2,000 characters per message |
| Order for a buyer (find products, add to cart, order now, place the cart) | A typed request | A confirm card naming items, quantities and total | Nothing changes until the buyer taps Confirm; the change is re-validated on the server | Tool errors are reported back plainly; no partial order | Buyer tools: 11 read, 17 confirm, 2 card-only |
| Act for a supplier (accept, part accept, reject, deliver, answer problems, stock and price changes, terms) | A typed request | A confirm card | Nothing changes until the supplier taps Confirm | As above | Supplier tools: 7 read, 17 confirm, 1 card-only |
| Add a product or a supplier | A request | A pre-filled form card | The person edits and taps the card's button; the model cannot call these tools itself | Duplicate names refused | Card-only tools |
| Talk to the other side about an order | A request to message, move a date or answer a date request | A confirm card with the message | Sent only after the tap; the model must not add details the person did not give | — | 30 order messages per hour |
| Explain an order on its page | The order's facts (status, lines, dates, minimum, problems) | Answers about that order, including why it is flagged | Read only unless a confirm card is tapped | — | — |
| Suggest follow-ups | — | Up to 2 tap-to-ask suggestions | Tapping sends the suggestion as a message | — | — |

Protections:
- Text from the database (names, notes) is treated as data, never as instructions.
- IDs are resolved on the server under the person's permissions.
- Writes always need a human tap.
- Usage (tokens, time and outcome) is recorded in `ai_usage`.

Not built:
- invoice reading;
- negotiation drafts;
- an evaluation set;
- the rule-based reader as a fallback inside the live assistant. It exists in the code but has no caller.

---

## 13. Reports and insights

| Metric | Definition | Source | Shown to |
| --- | --- | --- | --- |
| Spent this week | Total of the buyer's orders placed since Monday 00:00 Singapore time, excluding rejected and cancelled | `src/domain/insights.ts` (`weeklySpend`, `countsAsSpend`) | Buyer (Home, Insights) |
| Last week | The same for the previous Monday to Sunday | `weeklySpend` | Buyer |
| Weekly spend chart | Spend per week for the last 4 weeks and this week | `weeklySpend` | Buyer |
| Pace to Sunday | Where this week's spend lands by Sunday at the pace so far (at least half a day elapsed) | `src/domain/home.ts` (`weekPace`) | Buyer (Home) |
| Budget and left | Weekly budget and what is left (never below 0); level good below 75%, warning to 100%, over above | `budgetLeft`, `budgetUse` | Buyer |
| Spend by supplier | Spend per supplier over the 5 weeks, largest first, smallest folded into "Other"; whole percents add to 100 | `spendBySupplier`, `src/features/insights/queries.ts` | Buyer |
| On-time record | Percent of delivered orders that arrived on or before the confirmed date (Singapore date); good at 95% or more, warning from 85% | `onTimePercent`, `onTimeLevel` | Buyer |
| Overcharges caught | Sum of problem amounts with credit promised or received | `overchargesCaughtCents` | Buyer |
| Price changes | Changes on the buyer's usual items, newest first, with counts up and down | `priceChangeSplit`, Insights query | Buyer |
| Days left | (in shop + on order) ÷ use per day, one decimal | `src/domain/reorder.ts` (`daysLeft`) | Buyer |
| Today against a usual weekday | Order value and new orders so far today against the average of the same weekday over the last 4 weeks, up to the same time | `src/domain/home.ts` (`usualDay`) | Supplier |
| Customer pulse | Quiet: twice the buyer's usual gap (and at least 2 days) since their last order. Growing: at least 30% more orders in the last 30 days than the 30 before. | `customerPulse` | Supplier |
| Pick list | Quantities to pack, added up across today's orders, largest first | `pickList` | Supplier |
| Open orders and open order value | Orders pending, accepted or out for delivery, and their total | `src/features/admin/orderStats.ts` | Admin, supplier tiles |
| Operators online | Seen within 5 minutes; Away within 30 | `src/features/admin/presence.ts` | Admin |

---

## 14. Non-functional requirements

| ID | Category | Requirement | Verification |
| --- | --- | --- | --- |
| NFR-001 | Security | Every table has Row Level Security; signed-in users have no insert, update or delete policies; all writes go through checked database functions | Code review of migrations (no write policies found) |
| NFR-002 | Security | The Anthropic key and Supabase secret key are used only on the server and never sent to the browser | Code review (`server-only` modules) |
| NFR-003 | Security | Secrets live in `.env.local` and Vercel settings, never in the repository | `.gitignore`; repository scan on 4 November 2026 |
| NFR-004 | Security | Refused actions are logged as denied in the audit log | Code review (`callRpc`, `log_denied`) |
| NFR-005 | Security | Security headers: nosniff, Referrer-Policy, X-Frame-Options DENY, HSTS, Permissions-Policy | `next.config.ts` (no Content Security Policy, see section 18) |
| NFR-006 | Integrity | Stock is never oversold under concurrent orders | `tests/concurrency/reservations.test.ts` (24 parallel placements; opt-in, not run for this document) |
| NFR-007 | Integrity | Critical actions are idempotent | Code review (`app.idem_get`, `app.idem_put`) |
| NFR-008 | Integrity | Status changes follow the state models in section 9 | Database triggers (`app.guard_status`); `e2e/order-flow.spec.ts` |
| NFR-009 | Integrity | History tables are append-only | Database triggers (`app.forbid_change`) |
| NFR-010 | Privacy | Logs redact fields named like password, token, secret, key, authorization, cookie, text or email | `src/lib/logger.ts` (no test) |
| NFR-011 | Usability | Copy is sentence case, with no exclamation marks or emoji; buttons name a verb and an object | Design system rule; code review |
| NFR-012 | Accessibility | Skip link, labelled controls, status shown by word as well as colour, `aria-live` for chat, reduced motion respected | Code review; no automated accessibility test |
| NFR-013 | Responsiveness | Every buyer and supplier page fits a phone without sideways scrolling | `e2e/pages.spec.ts` (mobile project, Pixel 7) |
| NFR-014 | Compatibility | Tested in desktop Chrome and a Pixel 7 phone profile | `playwright.config.ts`; other browsers not verified |
| NFR-015 | Resilience | A failed page shows "This page did not load" with Try again; failed admin saves stay on the page | Error boundaries; checked by hand |
| NFR-016 | Resilience | Loss of network shows the offline page | `e2e/smoke.spec.ts` |
| NFR-017 | Cost control | AI chat 60 per hour per person; order messages 30 per hour | Code review (`hit_rate_limit`) |
| NFR-018 | Performance | No response-time or load targets have been measured | Not verified |
| NFR-019 | Availability | No uptime target or monitoring beyond a liveness endpoint (`/api/health`) | Not verified |
| NFR-020 | Maintainability | Strict TypeScript, no `any`, no `console.log`; lint, type-check and unit tests pass before deploy | `npm run lint`, `npm run typecheck`, `npm test` (run locally; there is no CI) |

---

## 15. Key product decisions

The first eight decisions are summarised in the table. Each one is then explained below, with the problem, options considered, final choice, reasons, tradeoffs and where it appears.

| Decision | Options considered | Choice | Reason | Tradeoff |
| --- | --- | --- | --- | --- |
| DEC-01 Responsive PWA, not native apps | Native iOS and Android; a responsive web app with a manifest and service worker | Responsive web app (PWA) | One codebase for phone and laptop; no app store | No install prompt or push today; iOS limits |
| DEC-02 Next.js and Supabase | Pages Router; separate auth provider; an ORM over a direct connection | Next.js App Router on Vercel; Supabase for Postgres, Auth and RLS | Set by the brief; RLS relies on Supabase's `auth.uid()` | Ties the product to two platforms |
| DEC-03 Permissions in server checks and RLS | UI checks only; RLS-only writes with triggers; writes from TypeScript | Reads through RLS; writes only through checked database functions | Permissions hold even if the UI is bypassed | Business rules live in SQL |
| DEC-04 Buyers review AI output before anything is sent | AI places orders directly; AI drafts for review | AI drafts; a person taps to confirm | AI can misread; orders commit money | One extra tap |
| DEC-05 Stock reserved in database transactions | Calculate on read; optimistic versions; row locks | Row locks in one transaction, in product order | No overselling, consistent history | Contention under heavy load (not measured) |
| DEC-06 Suppliers joining | Secure invitations; self sign-up | Self sign-up now; invitation acceptance not built | Easy to try | Anyone can create an account |
| DEC-07 Invoices checked but never paid | Pay through Tradelink; check only; no invoices | Check-only was decided; nothing built; no payments | Never move money | Invoice protection not available |
| DEC-08 Light and dark mode from the design system | Hand-coded colours; generated tokens | Tokens generated from the design system | One source for both themes | Theme is per browser |

### DEC-01 Responsive PWA instead of native apps

| Aspect | Detail |
| --- | --- |
| Problem | Buyers order from phones in kitchens and from laptops in the office. Suppliers work from both too. |
| Options considered | Native iOS and Android apps; a responsive web app; a PWA now with a Capacitor shell later |
| Final choice | One responsive web app, with an app manifest, a hand-written service worker and an offline page ([ADR 0016](../adr/0016-pwa-and-offline.md), [ADR 0026](../adr/0026-cards-jobs-and-pwa.md)) |
| Why | One codebase and one release for every device. No app store review. Works from a link. ADR 0016 plans a Capacitor shell later. |
| Tradeoffs | There is no install prompt and push is not switched on. On iPhone, push needs the app on the Home Screen. Offline use is limited to an offline page. |
| Where it appears | `app/manifest.ts`, `public/sw.js`, `src/pwa/`; phone bottom tabs and laptop top bar (`src/ui/shell/`) |

### DEC-02 Next.js and Supabase

| Aspect | Detail |
| --- | --- |
| Problem | A small team needs a secure web app with a database, sign-in and row-level permissions. |
| Options considered | Next.js Pages Router; Edge runtime everywhere; a separate auth provider (Clerk, Auth0); Prisma or Drizzle over a direct connection |
| Final choice | Next.js App Router on Vercel with strict TypeScript ([ADR 0002](../adr/0002-nextjs-on-vercel.md)); Supabase for Postgres, Auth and Row Level Security ([ADR 0003](../adr/0003-supabase-platform.md)) |
| Why | The brief fixes both. Server Components send less JavaScript to phones. One identity source keeps RLS simple, because policies use `auth.uid()`. An ORM over a direct connection would bypass RLS. |
| Tradeoffs | The product depends on two hosted platforms. Business rules are split between SQL and TypeScript. |
| Where it appears | `app/`, `src/data/`, `supabase/migrations/` |

### DEC-03 Permissions enforced by server checks and RLS

| Aspect | Detail |
| --- | --- |
| Problem | Buyers, suppliers and admins share one database. A hidden button is not a permission. |
| Options considered | Checks in the UI only; RLS-only writes with triggers; several queries from TypeScript |
| Final choice | Reads use the person's session and RLS. Writes go only through `security definer` database functions that check the caller, the state change and the inputs, and write the history in the same transaction ([ADR 0004](../adr/0004-writes-through-postgres-functions.md), [ADR 0005](../adr/0005-tenancy-and-connections.md)). The request proxy and `requireRole` only redirect; they are a convenience. |
| Why | A permission holds even if someone calls the API directly. Multi-row changes (orders, stock, audit) commit or fail together. |
| Tradeoffs | Rules live in SQL, which is harder to unit test. There are no pgTAP tests yet. |
| Where it appears | Every RPC in `supabase/migrations/`; `src/data/rpc.ts` (`callRpc`); `proxy.ts` |

### DEC-04 Buyers must review AI output before an order is sent

| Aspect | Detail |
| --- | --- |
| Problem | AI can misread a message or pick the wrong product, and an order commits the buyer to spend. |
| Options considered | AI places orders directly; AI drafts and a person confirms |
| Final choice | Tradelink AI can only propose. Each change appears as a confirm card, and runs only when the person taps it, as that person, with the input checked again on the server ([ADR 0008](../adr/0008-claude-integration.md), [ADR 0010](../adr/0010-untrusted-content-and-prompt-injection.md)). |
| Why | The person stays in control and accountable. A prompt-injection attack cannot place an order on its own. |
| Tradeoffs | One extra tap. "Order now" and Home's "Place tomorrow's order" confirm with a single tap, without the full cart review (Inferred rationale: speed for routine orders). ADR 0010 says the model "has no tools that write"; as built, the model has write tools, but every one is gated by a confirm tap. |
| Where it appears | `src/features/ai/registry.ts`, `src/features/ai/execute.ts`; confirm cards in Tradelink AI |

### DEC-05 Stock reserved in database transactions

| Aspect | Detail |
| --- | --- |
| Problem | Two buyers may order the last units at the same moment. Stock must never be oversold, and every change must be explained. |
| Options considered | Calculating balances from history on each read; optimistic versions; row locks |
| Final choice | `inventory_levels` holds on hand and reserved. Every stock change locks the rows in product order, checks availability again, updates the balances and appends a `stock_movements` row, all in one transaction ([ADR 0006](../adr/0006-inventory-history-and-reservations.md)). |
| Why | Row locks are simple and contention is low. The constraint `reserved <= on_hand` is a backstop. The history can be replayed to check the balances. |
| Tradeoffs | Locks can wait under heavy load (not measured). The rest of a two-part delivery is not reserved. |
| Where it appears | `place_orders`, `accept_core`, `app.lock_inventory`, `app.move_stock`; `tests/concurrency/reservations.test.ts` |

### DEC-06 How suppliers join: secure invitations, replaced by self sign-up

| Aspect | Detail |
| --- | --- |
| Problem | Suppliers must join so their buyers can order from them, and a business should only trade with the businesses it chose. |
| Options considered | Invitation-only onboarding with single-use, hashed, expiring tokens ([ADR 0011](../adr/0011-authentication-and-invitations.md)); open self sign-up |
| Final choice | Self sign-up ([ADR 0024](../adr/0024-self-sign-up-without-two-factor.md)). A new account is connected to every active business of the other kind. A buyer can add a supplier who is not on Tradelink as an *invited* record. **Invitation acceptance is not built**: no email, no token, no accept or decline page. |
| Why | The owner chose to make Tradelink easy to try (3 November 2026). Secure invitations remain the intended design before real businesses rely on Tradelink (ADR 0024, Consequences). |
| Tradeoffs | Anyone can create an account and see connected suppliers' prices. An invited supplier who signs up under the same name is blocked (BUG-02). |
| Where it appears | `/sign-up`; `app.handle_new_user`; `buyer_add_supplier`; the admin attention rule "has not joined" |

### DEC-07 Invoices are checked but never paid

| Aspect | Detail |
| --- | --- |
| Problem | Invoices can be wrong or carry changed bank details (fraud). Paying through the app would make Tradelink handle money. |
| Options considered | Pay invoices through Tradelink; check invoices only; leave invoices out |
| Final choice | The recorded decision is check-only, never pay (decision D6; [ADR 0021](../adr/0021-bank-detail-fingerprints.md)). **Invoice checking is not built.** On 4 November 2026 the owner also decided not to integrate Stripe or any payments. |
| Why | Never holding or moving money keeps risk and regulation low. Checks alone would catch overcharges and bank-detail changes. |
| Tradeoffs | Buyers get no invoice protection today. The `invoice` problem type exists in the database but cannot be created. |
| Where it appears | Nowhere in the live product; see section 18 |

### DEC-08 Light and dark mode use the current design system

| Aspect | Detail |
| --- | --- |
| Problem | Kitchens and offices have very different light. Colours must stay accessible in both themes and match the design. |
| Options considered | Copy colours into the Tailwind config by hand; generate tokens from the design system |
| Final choice | `npm run tokens` generates `src/styles/tokens.css` from `design-handoff/design-system/tokens.json`, with light values, dark values and a System mode that follows the device ([ADR 0015](../adr/0015-design-tokens-and-tailwind.md)). A cookie remembers the choice so the server renders the right theme with no flash. |
| Why | One source of truth for both themes; a design change is a JSON edit and a rebuild. |
| Tradeoffs | ADR 0015 planned to store the theme on the profile. As built, it is per browser (cookie); the profile column and `set_theme` function are unused. |
| Where it appears | Top-bar toggle and Settings > Appearance; `src/ui/ThemeToggle.tsx`, `app/layout.tsx` |

### Further decisions

| Decision | Options considered | Choice | Reason | Tradeoff |
| --- | --- | --- | --- | --- |
| DEC-09 One order per supplier | One combined order; one per supplier | One per supplier, placed together | Each supplier accepts, delivers and answers for its own goods | A cart can create several orders |
| DEC-10 Below-minimum orders are allowed | Block; warn | Warn and flag "Below minimum" ([ADR 0020](../adr/0020-minimum-order-negotiation.md)) | Decision D5: buyers sometimes need a small order | The supplier may still reject; negotiation not built |
| DEC-11 Lead and operators in Needs attention | Everyone sees everything; lead assigns and operators see their own | Lead sees and assigns all; operators see their own | Owner request, 4 November 2026 | Inferred rationale: clear ownership of each item. No ADR records it. |
| DEC-12 No payments or Stripe | Subscription billing; payments; none | None | Owner decision, 4 November 2026 | No revenue features |
| DEC-13 Two deliveries for a part-accepted order | Drop what cannot be sent; keep the rest for a later date | Supplier chooses either | Owner request, 4 November 2026 | The rest is not reserved |
| DEC-14 Notifications in-app only | Email; push; in-app | In-app only for now | Inferred rationale: no email provider is configured and push is not switched on; the sprint scope said "no real integrations" | People see updates only when they open the app |

---

## 16. Assumptions, dependencies and risks

### 16.1 Assumptions

| ID | Assumption |
| --- | --- |
| A-01 | All businesses and users are in Singapore and trade in Singapore dollars. |
| A-02 | Each person belongs to one business. |
| A-03 | Demo data is fictional. The demo accounts share one password that is never stored in the repository. |
| A-04 | Supabase email confirmation is a project setting; the app handles it on or off. |

### 16.2 Dependencies

| Dependency | Used for | If unavailable |
| --- | --- | --- |
| Supabase (Postgres, Auth) | All data, sign-in and permissions | The app cannot work |
| Vercel | Hosting | The app cannot work |
| Anthropic Claude API | Tradelink AI | Tradelink AI shows "not available"; the rest of the app works |

### 16.3 Risks

| ID | Risk | Impact | Current mitigation |
| --- | --- | --- | --- |
| R-01 | Open sign-up lets anyone see connected suppliers' prices | Data exposure at the demo stage | Accepted for the demo (ADR 0024); bring back invitations or approval before real use |
| R-02 | No two-factor sign-in for admins | Account takeover | Accepted for now (ADR 0024) |
| R-03 | AI misreads a request | A wrong order or change | Confirm before every write; server-side checks |
| R-04 | No CI; checks run by hand | A broken build reaches production | Lint, type-check and tests run before each push |
| R-05 | Stock double-count when the rest is delivered first (BUG-01) | Wrong stock figures | None yet |
| R-06 | Shared database for local development and production | Test data in live records | Demo data is fictional; tests that write are opt-in |
| R-07 | Pages left open across a deploy call actions that no longer exist | A failed save | Admin saves show "Reload the page"; buyer and supplier pages are not covered |

---

## 17. Requirements traceability

Status: **Built**, **Partial**, **Not built**. A requirement of "—" means none is defined because the story is not built.

| User story | Requirement | Screen | Test | Status |
| --- | --- | --- | --- | --- |
| SH-01 App shell and navigation | FR-010, FR-011 | All | `src/features/shell/nav.test.ts` | Built |
| SH-02 Home page pattern | FR-020, FR-060, FR-081 | SCR-10, SCR-20, SCR-30 | `src/domain/home.test.ts` | Built |
| SH-03 Theme | FR-012 | All | No automated test | Built (per browser) |
| SH-04 Responsive layout | FR-018 | All | `e2e/pages.spec.ts` | Built |
| SH-05 Confirmations | FR-085, FR-091 | SCR-11, SCR-33 | `src/features/ai/tools.test.ts` | Built |
| SH-06 Loading, empty and error states | FR-015, FR-016 | All | `e2e/pages.spec.ts` | Built |
| SH-07 Offline | FR-017 | SCR-05 | `e2e/smoke.spec.ts` | Partial |
| SH-08 Accessibility baseline | NFR-012 | All | No automated test | Partial |
| SH-09 Notifications for every role | FR-013, FR-014 | SCR-17, SCR-27, SCR-40 | `src/features/notifications/routes.test.ts` | Partial (in-app only) |
| SH-10 Live updates | — | — | — | Not built |
| SH-11 Audit logging | FR-087 | SCR-39 | No automated test | Built |
| SH-12 Writing and formatting | NFR-011 | All | `src/domain/money.test.ts` | Built |
| SH-13 Install as an app | — | — | `e2e/smoke.spec.ts` (manifest served) | Partial |
| SH-14 Team members | — | — | — | Not built |
| AUTH-01 Sign in | FR-001 | SCR-01 | `e2e/smoke.spec.ts` | Built |
| AUTH-02 Sign out | FR-002 | All | No automated test | Built |
| AUTH-03 Reset a forgotten password | FR-003, FR-004 | SCR-03, SCR-04 | `src/features/auth/password.test.ts` | Built |
| AUTH-04 Two-factor for admins | — | — | — | Not built (removed) |
| AUTH-05 Optional two-factor | — | — | — | Not built |
| AUTH-06 Role-based access | FR-006, FR-007 | All | `src/features/auth/routing.test.ts` | Built |
| AUTH-07 Accept an invitation | — | — | — | Not built |
| AUTH-08 Recent sign-in for sensitive changes | — | — | — | Not built |
| AUTH-09 Session expiry | FR-006 | All | `src/features/auth/routing.test.ts` | Built (Supabase sessions) |
| AUTH-10 Create an account | FR-005 | SCR-02 | `src/features/auth/signUp.test.ts` | Built |
| BUY-01 Buyer home | FR-020 | SCR-10 | `src/domain/home.test.ts` | Built |
| BUY-02 To do: price changes | FR-020, FR-054 | SCR-10 | `src/domain/todos.test.ts` | Built |
| BUY-03 To do: part deliveries | FR-047 | SCR-10, SCR-15 | `src/domain/todos.test.ts` | Built |
| BUY-04 To do: replies to problems | FR-020, FR-046 | SCR-10 | `src/domain/todos.test.ts` | Built |
| BUY-05 To do: invoice too high | — | — | — | Not built |
| BUY-06 To do: do not pay yet | — | — | — | Not built |
| BUY-07 To do: decisions waiting | FR-020, FR-048 | SCR-10 | `src/domain/todos.test.ts` | Built |
| BUY-08 Ready for tomorrow | FR-021 | SCR-10 | `src/domain/reorder.test.ts` | Built |
| BUY-09 Arriving and to check | FR-020, FR-040 | SCR-10, SCR-14 | `src/features/buyer/orders/filters.test.ts` | Built |
| BUY-10 Type or paste an order | FR-022 | SCR-11 | `src/features/ai/tools.test.ts` | Partial |
| BUY-11 Reading falls back safely | FR-093 | SCR-11 | `src/integrations/claude/read-order.test.ts` (reader not in live UI) | Partial |
| BUY-12 Usual items | FR-021, FR-023 | SCR-10, SCR-12 | `src/domain/reorder.test.ts` | Built |
| BUY-13 Add items manually | FR-024 | SCR-13 | `src/features/products/cart.test.ts` | Built |
| BUY-14 Review lines | FR-025 | SCR-12 | `src/features/ordering/line-view.test.ts` | Built |
| BUY-15 Quantities and units | FR-025 | SCR-12 | `src/features/ordering/line-ops.test.ts` | Built |
| BUY-16 Not enough stock and substitutes | FR-026 | SCR-12 | `src/features/ordering/line-ops.test.ts` | Built |
| BUY-17 Price warning | FR-027 | SCR-12 | `src/domain/review.test.ts` | Built |
| BUY-18 Add a missing product | FR-032 | SCR-12, SCR-11 | No automated test | Built |
| BUY-19 Add a product from a new supplier and invite them | FR-033 | SCR-11 | `src/features/ai/tools.test.ts` | Partial (no invitation) |
| BUY-20 Order summary, cut-offs and budget | FR-025, FR-029, FR-051 | SCR-12 | `src/domain/cutoff.test.ts` | Built |
| BUY-21 Delivery dates | FR-048 | SCR-15 | `src/features/ai/tools.test.ts` | Built |
| BUY-22 Confirm and reserve stock | FR-030, FR-031 | SCR-12 | `tests/concurrency/reservations.test.ts` | Built |
| BUY-23 CartBar | FR-025 | SCR-12 | `src/features/ordering/cart-groups.test.ts` | Built |
| BUY-24 Below a supplier's minimum | FR-028 | SCR-12, SCR-15, SCR-23 | `src/domain/minimum.test.ts` | Built |
| BUY-25 Negotiation replies and fees | — | — | — | Not built |
| BUY-26 Price confirmed higher than estimate | FR-062 (repricing on accept) | SCR-15 | No automated test | Partial (no buyer prompt) |
| BUY-27 Orders and invoices page | FR-040, FR-041 | SCR-14, SCR-15 | `src/features/buyer/orders/filters.test.ts` | Partial (no invoices) |
| BUY-28 Cancel a pending order | FR-042 | SCR-15 | No automated test | Built |
| BUY-29 All here | FR-043 | SCR-15 | No automated test | Built |
| BUY-30 Report a problem | FR-045 | SCR-15 | `e2e/order-flow.spec.ts` | Built |
| BUY-31 Not here yet | FR-044 | SCR-15 | No automated test | Built |
| BUY-32 to BUY-36 Invoices | — | — | — | Not built |
| BUY-37 Credits | FR-046 | SCR-14, SCR-15 | `e2e/order-flow.spec.ts` | Built |
| BUY-38 Insights summary | FR-050 | SCR-16 | `src/features/insights/summary.test.ts` | Built |
| BUY-39 Weekly spend chart | FR-050 | SCR-16 | `src/domain/insights.test.ts` | Built |
| BUY-40 Spend by supplier and record | FR-050 | SCR-16 | `src/domain/insights.test.ts` | Built |
| BUY-41 Price changes feed | FR-050 | SCR-16 | `src/domain/insights.test.ts` | Built |
| BUY-42 Availability | FR-024 | SCR-13 | `src/features/products/availability.test.ts` | Built (as Products) |
| BUY-43 Weekly budget | FR-051, FR-052 | SCR-18 | `src/domain/insights.test.ts` | Built |
| BUY-44 Alerts and suggestions | FR-052 | SCR-18 | No automated test | Built |
| BUY-45 What Tradelink can do | FR-090 | SCR-11 | No automated test | Built |
| BUY-46 My usual items | FR-053 | SCR-18 | `src/features/buyer/usual-days.test.ts` | Built |
| BUY-47 Ask chat | FR-090, FR-095 | SCR-11 | `src/features/ask/history.test.ts` | Built (as Tradelink AI) |
| BUY-48 Ask answers questions | FR-090 | SCR-11 | `src/features/ai/tools.test.ts` | Built |
| BUY-49 Ask prepares an order | FR-022, FR-091 | SCR-11 | `src/features/ai/tools.test.ts` | Built |
| BUY-50 Ask stays within my business | FR-090 | SCR-11 | `src/features/ai/tools.test.ts` | Built |
| SUP-01 Supplier home | FR-060 | SCR-20 | `src/domain/home.test.ts` | Built |
| SUP-02 Supplier to do | FR-060 | SCR-20 | `src/domain/home.test.ts` | Built |
| SUP-03 Incoming orders | FR-061 | SCR-22 | `src/features/supplier/orderFilters.test.ts` | Built |
| SUP-04 Accept an order | FR-062 | SCR-23 | `e2e/order-flow.spec.ts` | Built |
| SUP-05 Part accept | FR-063 | SCR-23 | No automated test | Built |
| SUP-06 Reject | FR-064 | SCR-23 | No automated test | Built |
| SUP-07 Out for delivery and delivered | FR-065, FR-066 | SCR-23 | `e2e/order-flow.spec.ts` | Built |
| SUP-08 Answer a below-minimum request | — | — | — | Not built |
| SUP-09 Answer problems | FR-067 | SCR-23 | `src/features/supplier/issues.test.ts` | Built |
| SUP-10 Inventory | FR-068 to FR-072 | SCR-24 | `src/features/supplier/stock.test.ts` | Built |
| SUP-11 Add a product | FR-068 | SCR-24 | `src/features/supplier/product.test.ts` | Built |
| SUP-12 Receive stock | FR-069 | SCR-24 | `src/features/supplier/stock.test.ts` | Built |
| SUP-13 Confirm a product a buyer added | FR-070 | SCR-24, SCR-23 | `src/features/supplier/stock.test.ts` | Built |
| SUP-14 Change price | FR-071 | SCR-24 | `src/features/supplier/validation.test.ts` | Built |
| SUP-15 Adjust stock | FR-072 | SCR-24 | `src/features/supplier/stock.test.ts` | Built |
| SUP-16 Stock history | FR-073 | SCR-25 | No automated test | Built |
| SUP-17 Activity | FR-074 | SCR-26 | `src/features/supplier/activity.test.ts` | Built |
| SUP-18 Business profile | FR-075 | SCR-28 | `src/features/supplier/profile.test.ts` | Built |
| SUP-19 Bank details | — | — | — | Not built |
| SUP-20 Accept an invitation | — | — | — | Not built |
| SUP-21 Decline an invitation | — | — | — | Not built |
| SUP-22 Suspended supplier | FR-085 | SCR-33 | No automated test | Built |
| ADM-01 Admin home | FR-081 | SCR-30 | No automated test | Built |
| ADM-02 Needs attention items | FR-080 | SCR-31 | `src/features/admin/attention.test.ts` | Built |
| ADM-03 Filters and tiles | FR-080 | SCR-31 | `src/features/admin/attention.test.ts` | Built |
| ADM-04 Assign to an operator | FR-082 | SCR-31 | `src/features/admin/attention.test.ts` | Built |
| ADM-05 Mark handled | FR-083 | SCR-31 | `src/features/admin/attention.test.ts` | Built |
| ADM-06 Supplier invitation follow-up | FR-080 | SCR-31 | `src/features/admin/attention.test.ts` | Partial (assign or handle only) |
| ADM-07 Resolve a dispute | FR-084 | SCR-31 | No automated test | Built |
| ADM-08 Admin notifications | FR-013 | SCR-40 | `src/features/notifications/routes.test.ts` | Built |
| ADM-09 All orders | FR-086 | SCR-32 | `src/features/admin/orderStats.test.ts` | Built |
| ADM-10 Suppliers | FR-086 | SCR-33 | `src/features/admin/params.test.ts` | Built |
| ADM-11 Supplier profile | FR-086 | SCR-34 | No automated test | Built |
| ADM-12 Suspend or reactivate | FR-085 | SCR-33, SCR-34 | No automated test | Built |
| ADM-13 Users | FR-086 | SCR-36 | No automated test | Built (view only) |
| ADM-14 Buyer details | FR-086 | SCR-37 | No automated test | Built (view only) |
| ADM-15 Invite a buyer business | — | — | — | Not built |
| ADM-16 Operators | FR-086 | SCR-38 | `src/features/admin/presence.test.ts` | Built (view only) |
| ADM-17 System status | — | — | — | Not built |
| ADM-18 Audit log | FR-087 | SCR-39 | `src/features/admin/params.test.ts` | Built |
| ADM-19 Admin settings | FR-012 | SCR-41 | No automated test | Partial |
| ADM-20 Connect a buyer and a supplier | — | — | — | Not built |
| AI-01 Structured, validated order reading | FR-022, FR-091 | SCR-11 | `src/integrations/claude/read-order.test.ts` | Partial |
| AI-02 Matching only my catalogue | FR-090 | SCR-11 | `src/domain/reader/grounding.test.ts` | Partial |
| AI-03 Quantities, units and clarification | FR-022 | SCR-11 | `src/domain/reader/grounding.test.ts` | Partial |
| AI-04 Prompt injection | FR-091 | SCR-11 | `src/features/ask/respond.test.ts` (older path) | Partial |
| AI-05 Usage logging | FR-090 | — | No automated test | Built |
| AI-06 Evaluation set | — | — | — | Not built |
| AI-07 Invoice reading | — | — | — | Not built |
| AI-08 Negotiation drafts | — | — | — | Not built |
| OPS-01 Inventory history | FR-073 | SCR-25 | `tests/concurrency/reservations.test.ts` | Built |
| OPS-02 No overselling | FR-030 | SCR-12 | `tests/concurrency/reservations.test.ts` | Built |
| OPS-03 Idempotent actions | FR-031 | — | No automated test | Built |
| OPS-04 State machines | Section 9 | — | `e2e/order-flow.spec.ts` | Built |
| OPS-05 Health checks | — | — | — | Partial (liveness only) |
| OPS-06 Structured logs | NFR-010 | — | No automated test | Partial |
| OPS-07 Rate limits | FR-049, FR-094 | — | No automated test | Partial |
| OPS-08 Demo data and accounts | — | — | — | Built |
| OPS-09 Retention jobs | — | — | — | Not built |
| OPS-10 Reliable email | — | — | — | Not built |
| OPS-11 Continuous integration | — | — | — | Not built |
| OPS-12 Performance | NFR-018 | — | — | Not built (not measured) |

---

## 18. Known limitations and future improvements

### 18.1 Not built

| Area | What is missing | Related stories |
| --- | --- | --- |
| Invoices | Upload, AI reading, checks against the order, bank-detail warnings, "do not pay yet", manual entry. The `invoice` problem type cannot be created. | BUY-05, BUY-06, BUY-32 to BUY-36, SUP-19, AI-07 |
| Invitations | Invitation emails, accept and decline pages, claiming an invited business, inviting buyers or colleagues | AUTH-07, SUP-20, SUP-21, ADM-15, SH-14 |
| Two-factor sign-in | Removed for now (ADR 0024) | AUTH-04, AUTH-05, AUTH-08 |
| Notifications | Email and push (push code exists but nothing sends) | SH-09, OPS-10 |
| Negotiation | Below-minimum requests, delivery fees, AI drafts | BUY-25, SUP-08, AI-08 |
| Admin | Approve suppliers, manage users or operators, connect a buyer and a supplier, system status | ADM-15, ADM-17, ADM-20 |
| Live updates | Pages refresh on navigation, not live | SH-10 |
| Change password in Settings | Only "Forgot password" changes a password | — |
| Install prompt | The browser's own "Add to Home screen" only | SH-13 |
| Operations | CI, retention jobs, an AI evaluation set, performance budget, a scheduled job runner | OPS-09, OPS-11, OPS-12, AI-06 |

### 18.2 Partial behaviour

| Area | Limitation |
| --- | --- |
| Typed orders | The live assistant reads orders with its tools. The rule-based fallback reader exists in the code but has no caller, so there is no fallback when Claude is unavailable. |
| Theme | Remembered per browser, not per account. |
| Rate limits | Only Tradelink AI and order messages are limited. |
| Stale pages after a deploy | Admin saves show "Reload the page"; buyer and supplier saves still show "This page did not load". |
| Audit log filter | The Organisation filter shows only changes made by that business, not changes made to it by others. |

### 18.3 Possible defects, recorded for review

These were found during the documentation audit. They have not been fixed; fixing them needs the owner's approval.

| ID | Possible defect | Effect | Evidence |
| --- | --- | --- | --- |
| BUG-01 | `deliver_rest` is allowed while the order is still accepted or out for delivery | If the rest is delivered before the first delivery, stock is counted twice: on hand ends too low and reserved is released too far | Migration `20261104015354` (`deliver_rest`, `deliver_order`) |
| BUG-02 | Sign-up treats an invited business name as taken | An invited supplier cannot join under its own name or take over the invited record | Migration `20261103104222` (`app.handle_new_user`) |
| BUG-03 | Supplier answers for "invoice" problems exist but no flow creates one | Dead path | Migration `20261103085139` (`report_problem` allows four types) |
| SEC-01 | Some later helper functions keep the default execute grant, and later tables have no explicit revoke | Low risk (RLS still blocks writes), but not as documented | Migrations `20261103131531`, `20261103133813`, `20261104015354` |
| SEC-02 | Any signed-in user can call `hit_rate_limit` with any action name | Rows can grow without limit | Migration `20261103085139` |
| SEC-03 | No Content Security Policy header | Weaker protection against injected scripts than ADR 0010 asks for | `next.config.ts` |
| OPS-01 | The job runner endpoint is public and no schedule calls it | Scheduled jobs never run | `src/jobs/http.ts`; `supabase/migrations/pending_ai_job_cron.sql` is not applied |
| OPS-02 | Suspending a supplier and cancelling an order lock rows in opposite orders | A rare deadlock; Postgres would abort one transaction | Migration `20261103085139` (`set_supplier_status`, `cancel_order`) |

### 18.4 Future improvements

| Improvement | Why |
| --- | --- |
| Bring back secure invitations and admin approval before real businesses use Tradelink | Closes R-01 and BUG-02 (ADR 0024) |
| Two-factor sign-in for admins | Closes R-02 |
| Invoice checks (without payment) | Delivers DEC-07 as decided |
| Email or push notifications | People learn about changes without opening the app |
| CI running lint, type-check, unit and read-only e2e tests on every push | Closes R-04 |
| Reconnect the rule-based reader as a fallback | Ordering keeps working when Claude is unavailable |
| Move the theme to the profile | Same theme on every device |
| Update the older documents and ADR statuses | See the Technical Specification appendix "Differences from older documents" |

### 18.5 Differences from older documents

Several documents in `docs/` describe planned designs that differ from the code. Examples:
- invoice, invitation and email tables;
- an `api` schema;
- admin two-factor;
- pgTAP and evaluation suites.

Many ADRs are still marked "Proposed" although they are built, and no ADR records the current tool-using assistant. The full list is in the Technical Specification appendix "Differences from older documents". This document follows the code.

---

## Appendix A. Glossary

| Term | Meaning |
| --- | --- |
| Buyer | A food business that orders from suppliers |
| Supplier | A wholesaler that sells to buyers |
| Admin, operator | A member of the Tradelink operations team |
| Operations lead | The operator who sees and assigns every attention item |
| Business, organisation | A buyer, supplier or platform company; every person belongs to one |
| Connection | A trading link between one buyer and one supplier |
| Invited business | A supplier record a buyer created for a business not yet on Tradelink |
| Cart, draft | The buyer's lines before placing |
| Order | One supplier's part of a placement |
| Pending, accepted, out for delivery, delivered, rejected, cancelled | Order statuses (shown as Placed, Accepted, Out for delivery, Delivered, Rejected, Cancelled) |
| The rest, second delivery | The part of a part-accepted order that comes later |
| Delivery check | The buyer's confirmation after delivery: All here, or a problem |
| Problem, issue | Something wrong with a delivery: short, damaged, wrong item, expired or late |
| Credit | Money the supplier agrees to take off; promised, then confirmed received by the buyer |
| Dispute | A supplier's refusal of a problem, resolved by an admin |
| On hand, reserved, available | Units in stock; units held for open orders; on hand minus reserved |
| Usual items | Products a buyer orders regularly, with usual quantity, amount in the shop and use per day |
| Minimum order | A supplier's smallest order value; below it the order is flagged, not blocked |
| Cut-off | The time by which an order must be placed for the earliest delivery |
| Needs attention | The admin work queue, derived from rules |
| Tradelink AI | The assistant inside the app, powered by Claude |
| Confirm card | A card that shows a proposed change and runs it only when tapped |
| RLS | Row Level Security: database rules that limit which rows a person can read |
| Idempotency key | A unique key sent with an action so a retry does not repeat it |
| PWA | Progressive web app: a website that can work like an app |

## Appendix B. Items for owner review

| Item | Section | What to confirm |
| --- | --- | --- |
| Inferred rationale: "Order now" and "Place tomorrow's order" confirm with one tap, without the full cart review | DEC-04 | Is a single confirm tap acceptable as "review" for these paths? |
| Inferred rationale: lead and operator visibility gives clear ownership of each item | DEC-11 | The reason, and whether to record an ADR |
| Inferred rationale: notifications are in-app only because no email provider or push is set up | DEC-14 | Whether email or push is planned |
| Inferred rationale: order numbers start at ORD-1044 and problems at ISS-302 to continue the prototype's numbering | BR-042 | The reason |
| Theme per browser instead of per account | DEC-08 | Keep, or move to the profile as ADR 0015 planned |
| Possible defects BUG-01 to OPS-02 | 18.3 | Which to fix |
| ADR 0010 says the model has no write tools; the build gates write tools with a confirm tap | DEC-04 | Update ADR 0010, or record a new ADR for the current assistant |
| BUY-26 "Price confirmed higher than my estimate": accepting reprices lines but the buyer is not asked | Section 17 | Whether a buyer prompt is needed |
