# Tradelink AI design

How the Tradelink AI layer works: agents, cards, the data model beside Tradelink, notifications and jobs.
Code and older migrations cite it by section, for example "section 4.2" (older ones as `docs/AI_DESIGN.md`, its former name).

## 1. Fixed product decisions (from the owner, not up for change)

- One app with two modes, **Shop** and **Supplier**. Sign-in is a phone number and an SMS code, and the role decides the mode. Someone with both roles gets a mode switcher. Staff on either side are sub-users with US-04 permissions.
- Suppliers without the app get a signed, expiring **web link** by SMS or email. It opens Supplier mode in the browser with the same screens and rules, plus a "Get the app" nudge.
- **No WhatsApp.** Notifications are push plus in-app cards. SMS and email are used only for sign-in codes and supplier links.
- Owners order by chatting in plain language (text, voice note, photo). Native screens back the chat up: pick sheet, cart and review, My list, Suppliers, Orders, Invoices, Alerts, Insights, Settings.
- **Every meaningful agent output is a typed, editable, versioned card** (section 4).
- Keep the current stack unless it blocks the sheet.
- Claude Sonnet stays the model (earlier owner decision). Nothing in the sheet needs Gemini.

## 2. Architecture

### 2.1 Recommendation on the client

**A responsive installable PWA now, built from the current Next.js app, wrapped later with Capacitor for the App Store and Play.** Section 9 asks the owner to confirm.

Why this over Expo / React Native:

- The supplier web link must be a web page with the same screens as Supplier mode. With a PWA, Shop mode, Supplier mode and the web link are one codebase and cannot drift.
- Everything already built (UI kit, shell, cards, Next.js routes) is reused. An Expo app means rewriting every screen in React Native and keeping a second web version for the link.
- The browser covers the sheet's device needs:
  - camera and barcode (BarcodeDetector, or a zxing fallback);
  - microphone for voice notes (MediaRecorder);
  - photos and file upload;
  - offline storage (IndexedDB) and a service worker;
  - push: web push on Android, and on iPhone once the app is added to the home screen (iOS 16.4 and later).
- **Gap:** US-50 wants App Store and Play listings with APNs/FCM push and a forced update screen. A Capacitor shell gives native push, haptics and store listings around the same code, so it can be added in a later milestone without a rewrite. Until then:
  - the forced update rule is enforced by `app_release.min_version` and the service worker;
  - haptics use `navigator.vibrate` on Android (iPhone has no web haptics).

### 2.2 Components

```
Shop mode / Supplier mode / Ops console   (Next.js PWA, one codebase; web link = Supplier mode in the browser)
        |  HTTPS (session cookie or signed link session)          ^ Supabase Realtime (chat, cards, typing, ticks)
        v                                                            |
Core API  = Next.js route handlers and server actions  ----->  Postgres functions (all writes, versions, state machines)
        |                                                            ^
        |-- Agent runtime: AG0 router + AG1..AG7 (Claude tool use, render_card)    |
        |-- Notification service (in-app, web push, SMS, email; quiet hours, budget) |
        |-- Job runner /api/jobs/run  <---- pg_cron every minute + pg_net (due jobs from the `job` table)
        v
Supabase Storage (photos, voice notes, invoices, PDFs)      `event` table (append-only metrics log)
External: SMS provider (sign-in codes and links), email (Resend), Google Places (ops onboarding),
          speech-to-text (voice notes, P1), Claude (text, photos and PDFs)
```

How the sheet's GCP services map to our stack:

| Sheet assumes | We use | Notes |
| --- | --- | --- |
| Cloud Run Core API, WebSocket | Next.js route handlers and server actions; Supabase Realtime | Realtime also carries the "Received" tick and the typing indicator. |
| Pub/Sub `msg.inbound` | A `chat_message` insert plus a direct call to the agent runtime; domain events in the `event` table | No separate bus is needed at pilot scale. |
| Cloud Tasks, Cloud Scheduler | A `job` table, with `pg_cron` every minute calling `/api/jobs/run` through `pg_net` with a shared secret | Vercel Hobby cron runs only daily, so the scheduler lives in Supabase. |
| Gemini on Vertex AI, Document AI | Claude Sonnet: text, tool use, images and PDFs | One model family and one grounding pattern. |
| Speech-to-Text | A speech-to-text provider (P1, US-07), decided then | Claude does not take audio. |
| pgvector or Vector Search | pgvector in Supabase, plus trigram search on names and nicknames | Used for item matching (US-03, US-06). |
| BigQuery events | An append-only `event` table with views; export later if needed | Feeds the US-49 scorecard. |
| Firebase Auth | Supabase phone auth with an SMS provider | 3 wrong codes block the phone and open an ops case. |
| FCM / APNs | Web push (VAPID) now; FCM/APNs through Capacitor later | |
| SendGrid | Resend (also fixes the reset and confirmation email gap) | |

### 2.3 Rules that carry over and harden

- Reads use the user's session (RLS). Every write goes through a Postgres function with an idempotency key. No insert, update or delete policies.
- **The agent writes only through the same functions, only within the shop's autonomy level** (US-71). Every agent decision is logged in `agent_action` with inputs, rule, confidence and undo window.
- **The model never supplies facts.** It returns intents, references (`shop_item_id`, `po_id`) and wording. Prices, totals, items, dates and states are always loaded from the database by the server before a card is rendered.
- Money is integer cents, times are Asia/Singapore, and state machines live in `app.state_transitions`.

## 3. Data model

The sheet's model replaces the current domain tables. Section 9 asks for approval. The current data is demo-only, so the proposal is a clean set of new migrations plus Tradelink AI mock data, keeping these: `audit_log`, `idempotency_keys`, `rate_limits`, `ai_usage`, `app.state_transitions` and the guard trigger.

### 3.1 Tables, grouped

| Group | Tables (key fields) |
| --- | --- |
| People and access | `app_user` (phone, role, language, lead_source, disabled), `device` (push subscription, platform, app_version, last_seen), `owner`, `staff_member` (PENDING, ACTIVE, REMOVED, active_from), `staff_permission` (confirm_cap, view_access, hide_prices, full_control_until), `ops_member` (role ops, gtm_helper or admin; assigned shops), `consent` (type, version, method, opt_out), `web_link` (token hash, supplier user, expires_at, revoked_at) |
| Shops and suppliers | `shop` (ONBOARDING, LIVE, paused; place_id, address, quiet hours, rest day, staff default, activation_status, licence), `outlet`, `supplier` (shared record: name, phone, place_id, verified), `supplier_user`, `shop_supplier` (PENDING, LIVE, OPTED_OUT; cut_off, delivery_days, delivery_window, minimum_order, delivery_fee, free_delivery_at, payment_terms, order_channel, seen_counts_as_accepted, ack_at) |
| Items and prices | `product` (global: barcode, brand, name, variant, pack_size, photos, halal, regulated, verified; never prices), `shop_item` (product, supplier, order_unit, base_unit, billing_type, nickname[], confirmed_words[], status, shelf_life_days, no_substitutes), `list_version` (n, DRAFT, LOCKED, DISCARDED, locked_by, undo_until), `catalogue_snapshot`, `price_observation` (source, price, unit, ref, accepted), `expected_price` (low, high, basis, n_observations, effective_from), `usage_rate` (per open day, usual qty, correction, in_usual), `learned_fact` (text, kind, forgotten_at), `calendar_event` (holiday, shop closure, supplier closure, supply news) |
| Ordering | `order` (shop and outlet; DRAFT, AWAITING_CONFIRM, CONFIRMED, CANCELLED; version, source, urgent, deadline, created_by, list_version_id, one_off), `order_line` (raw text, shop_item_id, qty, hint_qty, picked_by, picked_at, expected_price, delivery_date, status, warnings jsonb), `standing_order`, `daily_plan` (SCHEDULED, READY, SENT, SKIPPED, EXPIRED; version), `budget` (weekly limit) |
| Purchase orders | `purchase_order` (number R-nnnn, supplier, version, idempotency_key = order + supplier, channel, delivery_date, eta, urgent, state, sent_at, seen_at, accepted_version, outside_tradelink), `po_line` (per version: shop_item, qty, expected price, status, held), `supplier_reply` (source: tap, note, web link, phone, ops or owner; parsed lines; confidence; version tapped; person) |
| Delivery and money | `delivery` (window, eta, recheck_at, received_at, status), `delivery_issue` (type, qty, photo, photo_taken_at, claim_value, resolution), `credit` (OPEN, CLOSED; source, amount), `invoice` and `invoice_line` (if in scope, section 9), `quote_request` (QUOTE or MATCH; SENT, ANSWERED, EXPIRED) |
| Agent and comms | `chat_thread` (shop, supplier PO thread, support), `chat_message` (client_message_id unique, reply_to, attachments, transcript, author: owner, staff, supplier, agent or ops), **`card_instance`** (section 4.3), `agent_action` (agent, tool, inputs, rule, confidence, outcome, undo_until, undone_at), `autonomy_setting` (area, level, limit_cents, temporary level, restore_at), `alert` (type, priority, status SENT/QUEUED/MERGED/MUTED, release_at, merged_into), `notification` (channel, type, sent, delivered, opened), `notification_type` (name, language, channel, body, version), `notification_pref` (daily limit, muted types, per-type push) |
| Ops and running | `case` (type, shop, PO, due_at, status, assignee, claimed_at, ai_paused, reason_code, ops_minutes, blocking), `job` (kind, run_at, dedupe_key unique, payload, status, attempts), `event` (append-only metrics), `baseline`, `scorecard_snapshot`, `app_release` (platform, version, min_version), `feedback`, and `billing_account` / `subscription` if in scope |

### 3.2 State machines (all in `app.state_transitions`)

- **order:** `DRAFT -> AWAITING_CONFIRM -> CONFIRMED`; `DRAFT | AWAITING_CONFIRM -> CANCELLED`; `AWAITING_CONFIRM -> DRAFT` (edit makes version n+1). Lines can be `SCHEDULED`.
- **purchase_order:**
  - Send: `CONFIRMED -> SCHEDULED -> SENT`, or `CONFIRMED -> SENT`.
  - Supplier answers: `SENT -> ACCEPTED | PARTIAL | REJECTED | NO_REPLY | CANCELLED`.
  - After no reply or a partial: `NO_REPLY -> ACCEPTED | REPLACED | CANCELLED`, and `PARTIAL -> ACCEPTED | REPLACED | CANCELLED`.
  - Delivery: `ACCEPTED -> RECEIVED | LATE | ISSUE | RECEIVED_UNCONFIRMED | CANCELLED`, then `LATE -> RECEIVED | REPLACED | CANCELLED` and `ISSUE -> RECEIVED | DISPUTED`.
  - Invoices, if in scope: `RECEIVED -> INVOICED -> MATCHED | DISPUTED`.
  - Out of stock after ACCEPTED: `ACCEPTED -> PARTIAL` (resolves a gap in the sheet).
- **Others:**
  - `list_version`: `DRAFT -> LOCKED -> SUPERSEDED`; `DRAFT -> DISCARDED`.
  - `shop_supplier`: `PENDING -> LIVE -> OPTED_OUT`.
  - `shop`: `ONBOARDING -> LIVE`, plus a pause flag.
  - `daily_plan`: `SCHEDULED -> READY -> SENT | SKIPPED | EXPIRED`.
  - `case`: `OPEN -> CLAIMED -> CLOSED`.
  - `alert`: `QUEUED | SENT | MERGED | MUTED`.
  - `staff_member`: `PENDING -> ACTIVE -> REMOVED`.
  - `quote_request`: `SENT -> ANSWERED | EXPIRED`.

Every row that a card can act on carries `version`. A function that acts on it takes `p_version` and raises `TL409:STALE_VERSION` when it is not the latest (EC08).

## 4. Card system

### 4.1 Contract

The agent never answers with prose when a card fits. It calls one tool:

```ts
render_card({
  type: CardType,                       // e.g. "order_summary"
  subject: { kind: "order", id, version },
  data: { ...references and wording only... },
  actions?: ActionId[],                 // subset of what the card type allows
  reason?: string,                      // "Price 18% above what you usually pay"
  question?: { text, options }          // US-70: low confidence becomes one short question
})
```

The server then does the following:

1. It looks the type up in the **card registry**.
2. It loads the subject at that version and **hydrates the card from the database**: lines, prices, totals, dates and state. The model's data is limited to wording and references.
3. It validates the result against the card's Zod schema.
4. It applies the safety rules (section 4.6).
5. It stores a `card_instance` and publishes it over Realtime.

If validation fails, the agent gets the error back and no card is shown.

### 4.2 Registry

`src/cards/<type>/` holds, for each type:

- `schema.ts`: Zod schema for the data and editable fields;
- `actions.ts`: allowed actions, each mapped to one Postgres function and the states where it is enabled;
- `build.ts`: server hydration from the database;
- `Card.tsx`: the component.

Shared pieces:

- **`CardShell`:** header with title and subject (shop or supplier, order or PO number), a status chip, a "why" line with a Details link, the body, an editable-fields layer, an action bar, and a footer with timestamp and "v3".
- **Surfaces:** the same component renders in the chat, in the Alerts inbox and on the matching screen (Orders, PO detail, Invoices, ops console). Supplier mode and the web link use the same registry.

### 4.3 `card_instance`

`card_instance` fields:

- identity: `id`, `type`, `schema_version`, `audience` (shop, supplier or ops), `shop_id`, `supplier_id`;
- subject: `subject_kind`, `subject_id`, `subject_version`;
- content: `state`, `data` (jsonb), `actions` (jsonb), `reason`, `question`;
- placement: `surfaces`, `thread_id`, `message_id`;
- lifecycle: `created_by` (agent, user or system), `superseded_by`, `expires_at` (next version or cut-off), `created_at`.

RLS restricts each row to its shop's people, the supplier's users, or ops.

### 4.4 Actions and versions

1. A tap calls `POST /api/cards/:id/act` with `{ action, subjectVersion, clientActionId }`.
2. The server checks the card is not superseded or expired, then calls the mapped function with `p_version` and `p_key = clientActionId`.
3. A stale version returns the latest card with "That was an older version. Here's the latest:" and fresh buttons (EC08).
4. On success the subject's new state produces either an updated card (same version, new state chip) or a new card (new version). The old card becomes `superseded`: it shows "Updated, see latest" and its buttons turn off.

### 4.5 Editing in place

- **Editable fields:** quantity, item (opens the pick page), supplier, delivery date, price note.
- **Live checks as he types:** minimum order, cut-off, unit sanity (EC03), expected price (US-59), shelf life (US-64). These are shared domain functions in `src/domain`, run on the client for instant feedback and again on the server. Totals recalculate.
- **Saving:** calls `revise_<subject>(id, version, changes)`, which makes version n+1 and a new card. On a PO already sent, the edit becomes a change request to the supplier (US-12).

### 4.6 Safety rules enforced in the card layer

| Rule (sheet) | Enforced by |
| --- | --- |
| Tradelink AI never picks an item, even a single option (US-06, EC01) | `order_line.shop_item_id` can be set only by the owner's pick (`picked_by`, `picked_at`) or by the pin rule. Pick pages never preselect. Confirm refuses unpicked lines. |
| Quantities come only from the owner; the usual is a hint (EC02) | `qty` and `hint_qty` are separate fields. Computed baskets (US-09, US-11, US-72) are proposals the owner confirms with one tap. |
| Nothing goes to a supplier before Confirm on the latest version | POs are created only inside `confirm_order(order_id, p_version, p_key)`. Level 3 auto-send (December) is a recorded exception with Undo. |
| [Undo] while it can be undone (US-71) | `agent_action.undo_until`. The card shows Undo until then, and Undo calls `undo_agent_action`. |
| Why the card appeared | A `reason` is required on every unprompted card (alerts, plans, notices) and links to details. |
| Low confidence becomes one question, not a guess (US-70) | The confidence band is computed on the server. Medium shows the card's `question`; low opens a LOW_CONFIDENCE case. |

Card states (shown as a chip): `draft`, `awaiting_confirm`, `confirmed`, `sent`, `seen`, `accepted`, `partial`, `rejected`, `superseded`, `expired`, plus `done` and `undone` for notices. They map 1:1 to the subject's state machine.

### 4.7 Feel

- Taps update the card at once and roll back with a toast if the server refuses.
- An offline outbox in IndexedDB keys messages and taps by `client_message_id` and sends them on reconnect. The server de-duplicates (EC06), and a version check still applies.
- Skeleton loaders show while cards load.
- Confirm gives a short vibration where supported.
- Toasts carry Undo where an action can be undone.

### 4.8 Card catalogue (minimum set, mapped to stories)

| Card | Audience | Stories | Key actions | Milestone |
| --- | --- | --- | --- | --- |
| Welcome / Menu | Shop | US-01, 34 | Sign up, Book a demo, Order, Repeat usual, Talk to a person | M1, M6 |
| Terms | Shop | US-43 | Read and agree | M1 |
| ShopInvite (supplier welcome and acknowledgement) | Supplier | US-44, 54 | I agree, Call me first | M1 |
| ListItem | Shop | US-03, 51, 56 | Pick, Add to my list, Remove, Move | M2 |
| Supplier profile | Shop | US-02, 10, 32, 58 | Add details, Invite, Browse, Ask for latest | M2 |
| Onboarding draft review | Ops | US-38 to 42 | Fix gap, Send to owner | M2 |
| Check my list | Shop | US-01, 42 | Looks right, Wrong, This is my list | M2 |
| PickSheet entry and PickSheet item | Shop | US-06, 07, 08, 31 | Finish my order; per page: pick, qty, Something else | M3 |
| OrderSummary | Shop | US-06, 07, 08, 09, 12, 14 | Confirm, Edit, Cancel; inline qty, item, date; warnings for minimum, budget, waste, top-up | M3 |
| Cart line | Shop | US-06, 09 | Edit qty, change item, remove | M3 |
| DailyPlan | Shop | US-72, 27 | Send all, Review, Not today; Order these, Change, Skip | M3 |
| Question (low confidence) | Shop | US-70 | One short question with options | M3 |
| PurchaseOrder | Supplier | US-15, 16, 12, 17, 21, 53, 54 | Accept all; per line Accept, Change qty, Out of stock, Substitute; date and ETA; Out for delivery; Delivered; upload invoice; OK or Can't on changes | M4 |
| SupplierReply | Shop | US-16, 73, 12, 21 | Switch to X, Take offer, Skip; OK, Other supplier | M4 |
| AgentActionNotice | Shop | US-71, 73, 72 | Undo | M4 |
| Availability ask | Supplier | US-73 | Yes, can; No | M4 |
| DeliveryCheck | Shop | US-20 | All here, Not here yet, Problem | M5 |
| Claim | Supplier | US-20 | Credit, Replace next, Don't agree | M5 |
| LateDelivery | Shop and supplier | US-21 | On the way, Delayed (ETA), Not coming; OK, Other supplier | M5 |
| Handoff case and Support thread | Ops and shop | US-36, 48, 17, 53, 70 | Claim, Reply, Close with reason | M6 |
| StaffApproval | Shop | US-04, 28 | Approve, Edit, Reject | M7 |
| Settings toggle | Shop | US-05, 35, 71 | Toggle, Keep or Forget learned fact, Step up Yes or Not yet | M6, M7 |
| StandingOrder | Shop | US-11 | Save, Auto-send, Cancel; Send, Change, Skip this week | M7 |
| PriceAlert | Shop | US-30, 59, 61 | Ask why, Get other quotes, Accept, See options | M7 |
| PriceList change | Supplier and shop | US-18 | Publish to ticked shops; OK, Ask them | M7 |
| Substitute | Shop | US-31 | One button per approved item, Skip | M7 |
| QuoteRequest and QuoteComparison | Supplier and shop | US-60, 58 | Send price, Can't supply; Switch, Stay, Ask to match | M7 |
| BudgetGuard | Shop | US-28 | Send anyway, Edit | M7 |
| WasteGuard | Shop | US-64 | Make it 2kg, Keep 5kg (a line inside OrderSummary and DailyPlan) | M7 |
| WeeklySummary (with a small chart) | Shop | US-26, 32, 61, 63 | Full report, Switch pack, Get other quotes | M7 |
| CreditNote | Shop | US-20 | Credit, Replace next (from delivery claims only) | M5 |
| DueList | Shop | US-24 | Mark paid (records the owner's payment, never pays) | M7 |
| InvoiceCheck / Mismatch, BankChangeAlert | Shop | US-22, 23, 62 | Out of scope (owner decision, section 9.1) | none |
| OutsideOrder, MorningBrief, Pause, Feedback | Shop | US-52, 19, 35, 37 | Correct, Fix; Details; Pause; Great, Okay, Not great | M7 |

## 5. Agents

Each agent is a TypeScript module with a narrow set of tools. Every tool calls a Postgres function or a read query scoped by `shop_id`. Agents use Claude tool use with `render_card` as the only way to show output.

| Agent | Does | Tools (examples) |
| --- | --- | --- |
| **AG0 Orchestrator** | Classifies intent (ORDER, REPEAT, EDIT_ORDER, CANCEL_ORDER, QUESTION, ADD_ITEM, ADD_SUPPLIER, SETTINGS, MENU, PAUSE, HANDOFF, ASK_SUPPLIER, GET_QUOTES, OUTSIDE_ORDER and others) and handles two intents in one message (EC04). Checks role, outlet, pause, autonomy and confidence. Opens the merge window, routes to an agent, enforces the notification budget. | `classify`, `get_shop_context`, `open_case`, `render_card` |
| **AG1 Shop Ordering** | Merges lines, applies the pin rule, builds pick pages, runs the sanity check, builds summaries, handles Confirm and edits, outside orders and staff orders. | `find_shop_items`, `pin_line`, `revise_order`, `confirm_order`, `log_outside_order` |
| **AG2 Supplier Order** | Splits orders into POs and runs the self-check. Sends, merges same-day POs (EC05), reads supplier taps and notes with read-back, runs the chase ladder, asks backup suppliers, and switches within the autonomy level. | `send_po`, `apply_supplier_reply`, `ask_availability`, `switch_line` |
| **AG3 Delivery and Receiving** | Runs the arrival check, problem claims, the late flow and ETA re-checks, and the morning brief. | `open_arrival_check`, `record_delivery`, `raise_claim`, `mark_late` |
| **AG4 Invoice and Payment** | If in scope: reads and matches invoices, raises mismatches, tracks credits, runs the bank-detail check. Never pays. | `read_invoice`, `match_invoice`, `open_credit` |
| **AG5 Inventory and Insights** | Owns usage rates, the computed usual, the daily plan, waste guard, budget, answers and the weekly summary. | `compute_usual`, `build_daily_plan`, `spend_query` |
| **AG6 Price and Supplier Signals** | Owns expected prices, unusual prices, moves and creep, substitutes, quotes, reliability and pack deals. | `expected_price`, `check_price`, `request_quotes` |
| **AG7 Onboarding Assistant** (ops only) | Runs the guided 6-step checklist, place lookup, barcode and photo drafting, invoice reading into suppliers, terms, and the completeness check. | `places_search`, `draft_shop_item`, `read_onboarding_invoice` |
| **GW Gateway** | De-duplicates by client message id, shows the Received tick and typing indicator, delivers cards over Realtime, sends push, SMS and email, and serves web-link sessions. | |

Two further rules:

- **Confidence (US-70).** Each agent decision carries a band computed from model and rule signals:
  - **high** proceeds;
  - **medium** asks one short question;
  - **low** opens an ops case.

  Low always asks, at every autonomy level.
- **Autonomy (US-71).** Levels are set per area (shop orders, supplier problems). The fixed guardrails are checked in Postgres, so they hold even if the model is wrong: never move money, never add an item or supplier, never accept a price outside the expected range, never order an unapproved item.

## 6. Timers and notifications

- **`job` table and runner.**
  - Every timer in the sheet is a row with a `dedupe_key`, for example `chase:{po}:{step}` or `plan:{shop}:{supplier}:{date}`.
  - A job re-checks its subject's state before acting, so a cancelled or answered PO is never chased (EC28).
  - Jobs that need AI or external calls run in `/api/jobs/run`; pure state changes run in SQL.
- **Main schedules:**
  - merge window of 60 seconds;
  - daily plan at cut-off minus 2 hours, reminder at minus 1 hour;
  - chase ladder at cut-off minus 60, minus 35 and minus 15 minutes (urgent at plus 10, 15 and 20 minutes);
  - arrival check at window end plus 30 minutes;
  - late re-check at ETA plus 30 minutes;
  - supplier acknowledgement after 48 hours;
  - standing orders at cut-off minus 3 and minus 1 hour;
  - morning brief at 6:30am;
  - activation on days 1, 4, 7 and 14;
  - Undo restore after 2 weeks;
  - retention after 30 days.
- **Notification service.**
  - One entry point is told the type, audience, whether the message is prompted, unprompted or urgent, and its card.
  - It applies quiet hours, the daily unprompted limit (default 2), merging per item per day, mute after 3 ignored, and the urgent bypass (cut-off at risk, delivery problem, bank detail change).
  - The in-app card is always written. Push goes only when the app is in the background.
- **Channels and languages.**
  - SMS is used only for sign-in codes and supplier links, and email only for supplier links and legal notices.
  - All notification texts live in `notification_type` in English, Chinese, Malay and Tamil, checked for length and variables.

## 7. Security and privacy

- **Access control.**
  - RLS on every table, by shop membership, supplier-user membership or ops assignment.
  - Staff with hidden prices never receive price fields: the server removes them, and the UI does not just hide them.
- **Supplier web links.**
  - A web link is a sign-in: a random token stored hashed, tied to the supplier user's phone or email, expiring, and revoked on a number change.
  - A new device needs a one-time SMS code (US-53).
  - The SMS or email carries only the link.
- **Cross-shop privacy (EC31).** A supplier never sees another shop's prices or names, and a shop never sees another shop's anything. The shared `product` and `catalogue_snapshot` hold no shop data.
- **Untrusted content.** Supplier notes, photos, invoices and chat are data, never instructions. Prompts keep them in a quoted data section, and tools enforce scope on the server (ADR 0010 continues).
- **Data protection (PDPA).**
  - Consent stock history, STOP, and deletion after 30 days by anonymisation.
  - Legal records and the consent log are kept.
  - Every ops view and change is audit-logged.

## 8. Milestones

Each slice is usable end to end on the live app and ends with tests and a demo. P0 comes first, in the owner's order.

| Milestone | Stories | Delivers | Done when |
| --- | --- | --- | --- |
| **M0 Foundations** | Supports all | New schema core (people, shop, supplier, items, order, PO, chat, cards, jobs, events); card registry and `CardShell`; `render_card` and the agent runtime skeleton; job runner on pg_cron; notification service (in-app plus web push); PWA manifest, service worker and offline outbox; i18n scaffold; Playwright set-up; new mock data | A test card round-trip works: rendered, edited to v2, stale tap refused, Realtime update on two devices, offline tap replayed once |
| **M1 Access and modes** | US-01, 43, 44, 50 (web part), 55 (basic) | Phone-number sign-in (password now, SMS code when a provider is added); roles and modes with a switcher; welcome card and lead; terms and consent with STOP; supplier invite, acknowledgement and web link with one-time code; min-version gate; notification type registry | A new owner signs up by phone and agrees terms. A supplier opens an invite link without the app, agrees, and becomes LIVE. A second-role user switches mode. |
| **M2 List, suppliers, onboarding** | US-02, 03, 38, 39, 40, 41, 42 (+ 51, 56 view) | AG7 guided session in the ops console; place lookup; barcode and photo item drafting; onboarding invoice reading; supplier terms; completeness check; Check my list; list lock v1; add item and add supplier for the owner | Ops onboards a shop in one session, the owner locks a 40-item list, and suppliers are PENDING with terms |
| **M3 Chat ordering** | US-06, 09, 12 (before send), 72 (+ 69, 70, 71 levels 0 and 1) | AG0 router; AG1 with merge window, pin rule, pick sheet, sanity checks and versioned OrderSummary; computed usual; daily plan with cut-off timers; first usage rates and expected prices; confidence questions | "eggs, milk, bread..." leads to a pick sheet, a summary and Confirm. The daily plan arrives at cut-off minus 2 hours. Stale taps are refused. Quantities are never prefilled. |
| **M4 POs and suppliers** | US-15, 16, 17, 53, 73, 12 (after send) (+ 71 level 2) | AG2: split, self-check and send; PurchaseOrder card in Supplier mode and on the web link; per-line actions; roll-up; chase ladder with SMS link and ops case; backup asks; same-item switch with Undo; PO change versions | One order reaches two suppliers (one with the app, one on a web link). Out of stock leads to a backup ask and a switch with Undo. A silent supplier is chased and reaches ops at cut-off minus 15 minutes. |
| **M5 Delivery** | US-20, 21 (+ 19) | AG3: arrival check, problem screen with photo, claims and credits, late flow with ETA, morning brief | All here, Problem and Not here yet each run end to end with the supplier's answer |
| **M6 Ops and the agent brain** | US-48, 49, 69, 70, 71, 34, 36, 45 | Ops console queue with cut-off alerts, rota and replies with the agent paused; scorecard and baseline; test-set gate; learned facts with Forget; notification budget; autonomy settings and step-up; menu; talk to a person; first-week activation jobs | Ops works a day of cases. The scorecard shows real numbers. A prompt change is blocked by a failing test case. |
| **M7 P1, then P2** | US-04, 05, 07, 08, 11, 18, 25 to 33, 35, 37, 47, 51, 52, 54 to 61, 63 to 65, 14, 10, 24 (due list and Mark paid only) | In priority order, grouped by agent. Capacitor store build and native push before or with US-50's store part. Out of scope by owner decision: US-22, 23, 46, 62. US-66 to 68 stay in 2027. | Per story acceptance criteria |

I'll build one milestone at a time and show each one before starting the next. Rough size: M0 and M3 are the largest, and each milestone is several sessions of work. I'll report progress against the acceptance criteria rather than dates.

## 9. Decisions

### 9.1 Owner answers (3 November 2026)

| Question | Answer | Effect on this plan |
| --- | --- | --- |
| Client | PWA now, store app later | As in section 2.1. A Capacitor shell comes later for store listings and native push. |
| Schema | Replace with the Tradelink AI model | M0 adds new migrations and Tradelink AI mock data. It keeps `audit_log`, `idempotency_keys`, `rate_limits`, `ai_usage` and `app.state_transitions`. |
| Money | Only the due list and Mark paid (US-24) | **Out:** invoice reading and matching (US-22, 23), the bank-detail alert (US-62, reversing the earlier "keep the bank-detail check"), and Stripe billing (US-46). **In:** "due this week" and Mark paid, with amounts estimated from delivered POs and each supplier's payment terms (no invoices), plus a monthly spend statement. Tradelink AI records payments the owner says he made; it never pays. Price signals use PO line prices, supplier answers and price notices instead of invoices. Credits come from delivery claims (US-20). |
| SMS provider | None for now | Sign-in stays phone-number based, with a password until a provider is added; the SMS-code step is behind a switch that turns on with a provider. Supplier invites and web links are shared by the owner with copy link or the share sheet (US-44 already allows this), not by SMS from Tradelink AI. Until SMS exists, a web link is a bearer sign-in: random, stored hashed, expiring, revocable and scoped to one supplier and its shops. The new-device code (US-53) and the chase ladder's SMS step (US-17) are skipped, so the ladder goes push, reminder push, then the ops call. |

### 9.2 Original questions

1. **Client:** a PWA now with a Capacitor shell later for the stores (recommended), or an Expo / React Native app now.
2. **Schema:** replace the demo tables with the Tradelink AI model in new migrations and reseed mock data (recommended, since the data is demo only), or evolve the current tables step by step.
3. **Money scope.** The sheet includes features that touch money:
   - invoice reading and matching (US-22, 23);
   - a due-this-week list with Mark paid (US-24);
   - a bank-detail change alert (US-62; matches the earlier "keep the bank-detail check");
   - a Stripe subscription for Tradelink AI itself (US-46, P0 in the sheet).

   **Recommendation:** keep invoices and the bank-detail alert, since Tradelink AI never pays. Keep the statement as spend only. Defer Mark paid and Stripe billing until the owner decides on charging.
4. **SMS provider** for sign-in codes and supplier links: Twilio is recommended (native in Supabase phone auth). This needs:
   - the owner's Twilio account;
   - registration of the "Tradelink AI" sender ID with Singapore's SMS Sender ID Registry (SSIR); unregistered alphanumeric senders are marked "Likely-SCAM";
   - later, a backup provider (US-50).
5. **Later, not blocking M0 to M2:**
   - a speech-to-text provider for voice notes (US-07, P1);
   - a Google Maps Places API key for ops onboarding (US-38, M2);
   - the name and logo switch from Tradelink to Tradelink AI (default: rename in M1, keeping the repository and Vercel names).

## 10. Proposed answers to gaps in the sheet

Each will be recorded in an ADR as it is built.

- **Reused edge-case ids (EC17, EC29, EC32):** the code uses specific reason codes, for example `EC17_ITEM_AWAITING_OPS` and `EC17_UNREADABLE`.
- **Thresholds (all in a settings table so ops can tune them; numbers are proposals):**
  - unusual price: outside the expected range by more than 10%, and more than S$2 per line;
  - confidence bands: high 0.85 and above, medium 0.6 to 0.85, low below 0.6, plus rules such as "two or more candidates is never high";
  - default quiet hours: 10pm to 6am;
  - weekly summary: Monday 8am;
  - finish-order reminder: cut-off minus 1 hour.
- **Out of stock after ACCEPTED:** the PO moves `ACCEPTED -> PARTIAL` and the US-73 flow runs.
- **Credit (US-23):** opens when the supplier taps Will credit; a query alone does not open one.
- **Ops hours:** the rota runs 5:30am to the last cut-off. The promise to the owner is "within 15 minutes, 6am to 10pm".
- **STOP:** bare STOP mutes notifications only. "Stop Tradelink AI", "delete my data" or "Stop after pilot" starts offboarding after a confirm card.
- **Deletion (US-47):** personal fields are anonymised in append-only tables. Legal records and the consent log are kept for their legal period.
- **Standing order, daily plan and usual for the same cut-off:** the standing order wins its lines, the plan leaves out anything already ordered or standing (EC34), and "usual" on demand shows a merged view.
- **Missing storage:** `learned_fact`, `notification_pref`, `budget`, `stock_count`, `feedback` and `pending_supplier_question` are added as tables.
- **US-13:** missing from the sheet; nothing is planned for it.
