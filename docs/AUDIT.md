# Audit: Tradelink against the Restock spec

This audit compares the current Tradelink code with the Restock by Ledger spec (`Restock_AI_Copilot_US_App.xlsx`, 72 user stories, 3 November 2026). The sheet is the source of truth. "Keep", "Change" and "Missing" below are measured against it.

The sheet was read in full: every story and every column. Per-story digests (agents, cards, data, states, timers, rules, acceptance, edge cases) were used to write this audit and `docs/PLAN.md`.

## 1. What Tradelink is today

| Area | Today |
| --- | --- |
| Client | Next.js 16.4 App Router, React 19.3, strict TypeScript 6, Tailwind 4 with design tokens, Inter font. Responsive web app; no service worker, web manifest, push or offline queue yet. |
| Hosting | Vercel (sin1), `main` deploys to production at tradelink-nine.vercel.app. |
| Database | Supabase Postgres (ap-southeast-1): 27 tables, about 40 `security definer` functions, RLS on every table, select-only policies. |
| Writes | Only through Postgres functions (`callRpc`), with idempotency keys, row locks and `TLnnn:REASON` errors. |
| State machines | Transition table (`app.state_transitions`) and a guard trigger for order, issue and organisation status. |
| Append-only | `audit_log`, `stock_movements`, `price_changes`, `order_events` (triggers refuse update and delete). |
| Auth | Supabase email and password, self sign-up for buyers and suppliers, password reset. Two-factor was removed by owner decision. |
| Roles | `buyer`, `supplier`, `admin` (admin = operations). Membership per organisation. |
| AI | Claude Sonnet through `@anthropic-ai/sdk`: a typed-order reader (structured output, grounded against the text and catalogue, rule-based fallback) and the Tradelink Assistant (regex intent router, grounded answers from numbered facts, typed cards). Every call is logged in `ai_usage`. |
| Tests | Vitest: 546 unit tests. An opt-in concurrency test proves reservations never oversell. No Playwright suite. |

### Data model today

- **Business:** `organisations` (buyer or supplier), `profiles`, `memberships`, `trading_connections` (buyer to supplier, invited/active/declined/ended), `supplier_profiles`, `buyer_settings`, `admin_profiles`.
- **Catalogue and stock:** `products` (a supplier's catalogue with price and status), `inventory_levels`, `stock_movements` (ledger), `price_changes`, `price_change_acks`.
- **Ordering:** `order_drafts` (the cart), `orders` (one per supplier: pending, accepted, out_for_delivery, delivered, rejected, cancelled), `order_lines`, `order_events`, `partial_fulfilments`.
- **After delivery:** `issues` (open, credit_promised, replacement_promised, supplier_replied, disputed, closed, credit_received).
- **Buyer memory:** `usual_items`, `restock_skips`.
- **Platform:** `notifications`, `attention_states`, `audit_log`, `idempotency_keys`, `rate_limits`, `ai_usage`.

### Screens today

- **Buyer:** Home, Assistant (chat with cards), Products, Cart, Orders (list, filters, detail), Insights, Settings, alerts pop-up.
- **Supplier:** Home, Orders, Inventory, Stock history, Activity, Settings, Notifications.
- **Admin:** Needs attention (assignment, disputes), Orders, Suppliers, Users, Operators, Audit log, Notifications, Settings.

## 2. Where Tradelink and the spec disagree in principle

These are design conflicts, not just missing features. Each needs the change described.

1. **Who picks the item.** Tradelink's reader auto-matches a product when confident, and "Order my usual" fills in quantities. The spec forbids both:
   - A line skips the pick sheet only if it is pinned: exact name, own nickname, a confirmed word, a barcode or photo, or a past order.
   - A one-option page still needs the owner's tap.
   - Quantities come only from the owner (EC02). Computed baskets (US-09, US-11, US-72) are allowed only as proposals he approves.
2. **Whose catalogue.** Tradelink suppliers own their catalogue, prices and stock, and stock is reserved when an order is placed. In the spec:
   - Suppliers often have no app at all.
   - Ops builds a per-shop, versioned, locked item list (`shop_item`, `list_version`) from a shared product database with no prices.
   - Prices are learned per shop (`price_observation`, `expected_price`).
   - Supplier stock is not tracked; suppliers answer per line instead: Accept, Change qty, Out of stock, Substitute.
3. **Order shape.** Tradelink's order is per supplier and goes straight to `pending`. The spec splits it in two:
   - **Shop order:** `DRAFT -> AWAITING_CONFIRM -> CONFIRMED`, with SCHEDULED lines.
   - **Purchase order (PO), one per supplier and versioned:** `SENT -> ACCEPTED / PARTIAL / REJECTED / NO_REPLY / REPLACED / CANCELLED`, then `RECEIVED / LATE / ISSUE / RECEIVED_UNCONFIRMED / DISPUTED`.
   - Every button carries an id and version, and a tap on an older version never counts (EC08).
4. **Sign-in and channels.** Tradelink uses email and password and in-app notifications only. The spec requires:
   - Phone number with an SMS code for everyone.
   - Push notifications.
   - Signed, expiring supplier web links by SMS or email.
   - A notification budget and quiet hours.
5. **The agent writes.** Tradelink's rule is "the AI never writes data". The spec has autonomy levels (US-71): at Act within limits the agent switches a supplier for the same item by itself, with [Undo], inside fixed guardrails. The rule therefore becomes: the agent writes only through the same audited Postgres functions, only within the shop's autonomy level, and every action is logged in `agent_action` with its confidence and undo window.
6. **Who sets things up.** Tradelink lets businesses sign themselves up and connects them to everyone. The spec runs sign-up through ops:
   - A lead signs up and agrees to terms.
   - Ops runs a guided onboarding (US-38 to US-42).
   - The owner locks his list.
   - Each supplier acknowledges the exact-item rule (US-44) before any order is sent.
   - Nobody is connected automatically, and Restock never cold-contacts a supplier.
7. **Money.** Earlier owner decisions were: no payments on the platform, prices used for analytics, and keep the bank-detail check. The spec agrees that Restock never pays a supplier, but it adds:
   - invoice reading and matching (US-22, US-23);
   - a due-this-week reminder with Mark paid (US-24);
   - a Stripe subscription for Restock itself (US-46, $80 per outlet per month).

   These need a decision (`docs/PLAN.md`, section 9).

## 3. Keep

| What | Why it fits the spec |
| --- | --- |
| Next.js on Vercel, Supabase Postgres, Auth, RLS, Storage, Realtime | Covers the Core API, database, file storage and live chat the sheet needs. pgvector is available in Supabase for item matching. |
| Writes only through Postgres functions, idempotency keys, row locks, error codes | Matches the sheet's idempotency rules (EC06, EC24) and the "server rejects stale taps" rule. Every card action becomes one of these functions. |
| `app.state_transitions` and the guard trigger | Becomes the single source for the order, PO, list, case, plan and alert state machines. |
| Append-only `audit_log` and event tables | Matches `agent_action` and the event log. Needs an anonymise carve-out for US-47 deletion. |
| Money in integer cents, `numeric(12,2)`, Asia/Singapore time (`src/domain/money.ts`, `singapore-time.ts`, `cutoff.ts`) | Every price, total, cut-off and delivery date in the sheet relies on these. |
| Claude integration pattern: structured output, Zod validation, grounding against input and catalogue, rule fallback, `ai_usage` logging | Becomes the base of AG0 to AG7 and the `render_card` tool. Claude stays the model (owner decision: Sonnet); Gemini is not required by anything in the sheet. |
| Design tokens, UI kit (`src/ui`), shell with the alerts pop-up, cart pill, user menu | Reused for Shop mode, Supplier mode and the web link. The pop-up becomes the Alerts inbox. |
| Typed assistant cards (order, price, lines) and the chat surface | Starting point for the card registry, rebuilt as versioned, persisted cards. |
| Admin needs-attention queue with assignment and dispute resolution | Base of the ops console and handoff queue (US-48). |
| Insights maths (weekly spend, supplier share, on-time record), restock-days maths (`src/domain/restock.ts`) | Reused by US-25, US-26, US-32 and as the first version of usage rates (US-69). |
| Vitest setup and the domain-first structure (`src/domain` pure and tested) | The sheet's acceptance criteria map well to unit tests. Playwright still needs adding. |

## 4. Change

| Today | Change to |
| --- | --- |
| Email and password sign-in, self sign-up | Phone number with SMS code (Supabase phone auth plus an SMS provider), lead to owner sign-up with terms and consent (US-43), 3 wrong codes block the phone (EC20). |
| Roles buyer, supplier, admin | `owner`, `staff` (caps, 24h activation, US-04), `supplier_user` (one ordering account per supplier per shop), `ops`, `gtm_helper`, `admin`. The role decides Shop or Supplier mode; a user with both gets a mode switcher. |
| `organisations` for buyers and suppliers | `shop` (ONBOARDING, LIVE, paused), `outlet`, `owner`, and a shared `supplier` record reused across shops (EC31) with private per-shop terms in `shop_supplier`. |
| `trading_connections` (auto-connected) | `shop_supplier`: PENDING, LIVE, OPTED_OUT, with cut-off, delivery days and window, minimum order, delivery fee, payment terms and order channel (app, web link by SMS, web link by email). LIVE only after the supplier acknowledges the exact-item rule (US-44). |
| Supplier catalogue `products` with prices and stock | Global `product` (barcode, brand, name, variant, pack size, photos, halal, regulated; never prices), per-shop `shop_item` (nicknames, confirmed words, order and base unit, billing type, supplier) inside a versioned, locked `list_version`, and `catalogue_snapshot` per supplier. |
| `price_changes` | `price_observation` (every price seen, with source) and `expected_price` (range per item and supplier, with basis and "based on N orders"). |
| `order_drafts` and per-supplier `orders` | Shop `order` and `order_line` (DRAFT to CONFIRMED, version, urgent, deadline, source) plus versioned `purchase_order` and `po_line` with the full PO state machine and `supplier_reply`. |
| Reservation at order time, inventory ledger | Not in the ordering path. Suppliers answer per line. The ledger tables stay but are no longer used by ordering. |
| `issues` with credit, replace and dispute | `delivery` and `delivery_issue` (short, damaged, wrong, expired, with a photo and photo time) and `credit` (OPEN to CLOSED), driven by the timed arrival check (US-20). |
| `usual_items` with fixed usual quantities | `usage_rate` per item (use per open day, calendar effect, edit habit) feeding a freshly computed usual (US-09), and owner-visible learned facts with Forget (US-69). |
| `notifications` | `notification` (push and in-app, with sent, delivered and opened times), `alert` (priority, status SENT, QUEUED, MERGED or MUTED, release time) and a `notification_type` registry in 4 languages. |
| Assistant: regex router, cards held only in the browser | AG0 orchestrator with intents, confidence and autonomy checks, routing to AG1 to AG7. Each agent has narrow tools over the Postgres functions. All output goes through `render_card`, and cards are stored in the database. |
| Cart page | The cart becomes the order review screen behind the order summary card. A new full-screen pick sheet sits over the chat. |
| Admin area | Ops console: a case queue sorted by cut-off, cut-off-timed alerts, rota, replies into the shop chat with the agent paused, the onboarding assistant, scorecard. |
| English only | English, Chinese, Malay and Tamil for every screen, card and notification. Replies follow the owner's language even when he mixes them (EC23). |

## 5. Missing

Grouped by the sheet's categories. P0 items are in bold.

- **Setup and profile:**
  - **Lead funnel and welcome card (US-01).**
  - **Terms, consent ledger, STOP and the 14-day terms grace (US-43).**
  - Supplier add and link with duplicate check (US-02).
  - **Add item from the product database or by scan, never from typed words (US-03).**
  - Staff with caps (US-04).
  - Settings with quiet hours, autonomy and learned facts (US-05).
  - List versioning and editing (US-51, US-57).
  - My shop view (US-56).
  - Account changes by a person (US-55).
- **Ordering:**
  - **60-second merge window, pin rule, pick sheet, sanity check, versioned summary, Confirm, Edit and Cancel (US-06).**
  - Voice (US-07) and photo (US-08) input.
  - **Computed usual (US-09).**
  - Browse a supplier (US-10).
  - Standing orders (US-11).
  - **Edit or cancel through PO versions (US-12).**
  - Multi-outlet (US-14).
  - **Daily restock plan at cut-off minus 2 hours (US-72).**
- **Supplier comms:**
  - **PO split with self-check and the urgent path (US-15).**
  - **Per-line supplier actions and the roll-up (US-16).**
  - **Chase ladder (US-17).**
  - **Supplier invite and acknowledgement (US-44).**
  - **Supplier web link (US-53).**
  - **Agent handles suppliers: backup asks and same-item switch (US-73).**
  - Price notices (US-18).
  - Outside orders (US-52).
  - Supplier serving many shops (US-54).
  - Ask a supplier (US-58).
- **Delivery:**
  - **Arrival check and problems (US-20).**
  - **Late delivery (US-21).**
  - Morning brief (US-19).
- **Invoices and money:** invoice check (US-22), mismatch and credits (US-23), due and statement (US-24), bank detail change (US-62).
- **Insights and control:**
  - Ask anything, with staff gating (US-25).
  - Weekly summary (US-26).
  - Cut-off reminder (US-27).
  - Budget guard (US-28).
  - Stock count (US-29).
  - Waste guard (US-64).
- **Price and supplier signals:**
  - Price moves (US-30), unusual price catcher (US-59), price creep (US-61).
  - Substitutes (US-31), quotes (US-60), pack deals (US-63).
  - Reliability (US-32), out-of-stock pattern (US-65).
  - Festive prep (US-33).
  - Later (2027): early warning (US-66), market index (US-67), supply shock (US-68).
- **Help:**
  - **Menu (US-34).**
  - Pause (US-35).
  - **Talk to a person with the agent paused (US-36).**
  - Feedback (US-37).
- **Ops onboarding:** **guided shop session with place lookup (US-38), barcode scan (US-39), invoice reading into suppliers (US-40), supplier terms (US-41), review and hand to owner (US-42).**
- **Running Restock:**
  - **First-week activation (US-45).**
  - **Trial to paid (US-46).**
  - Offboarding and deletion (US-47).
  - **Ops console (US-48).**
  - **Quality metrics, baseline and test-set gate (US-49).**
  - **App release, push, SMS and email readiness (US-50).**
- **Agent brain:**
  - **Shop memory and expected price (US-69).**
  - **Confidence routing and the notification budget (US-70).**
  - **Autonomy levels with guardrails and Undo (US-71).**
- **Platform:**
  - A job scheduler for about 40 timers.
  - Push (web push now, native later).
  - An SMS provider with a registered sender ID, plus a backup.
  - Transactional email.
  - PDF rendering.
  - Speech-to-text.
  - Document reading for invoices.
  - A place lookup.
  - An offline outbox with client message ids.
  - An event log for metrics.
  - A Playwright end-to-end suite.

## 6. Spec issues to settle while building

These come from the sheet itself. Proposed resolutions are in `docs/PLAN.md`, section 10.

- Some edge-case ids are reused for different meanings: EC17 (new item awaiting ops, and an unreadable voice note or photo), EC29, EC32 and EC20.
- Thresholds are not given: what counts as an unusual price (US-59), confidence bands (US-70), quiet-hours default, weekly summary default, several reminder times.
- Order states and PO states are mixed in places (US-72 uses SENT on the order; "held" in US-11 is not a state).
- Out-of-stock after ACCEPTED (US-73) has no defined transition.
- US-23 opens a credit at two different moments.
- Storage is not defined for: learned facts, supplier metrics, notification limit and mutes, budget, stock count, feedback, pending supplier questions.
- Ops hours differ: 6am to 10pm (US-36) against a rota from 5:30am to the last cut-off (US-48).
- Bare STOP mutes notifications (US-47), while "Stop after pilot" starts offboarding (US-46).
- Deletion (US-47) conflicts with append-only logs. Personal data is anonymised and legal records are kept.
- US-13 is missing from the sheet (numbering jumps from US-12 to US-14).
