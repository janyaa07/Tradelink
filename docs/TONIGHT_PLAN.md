# Tonight's plan: working app by 23:00 SGT, 3 November 2026

> **Outcome:** production went live at 18:05 SGT at https://tradelink-nine.vercel.app with the full scope in section 2. The stretch items Ask and Insights followed by 18:45. Still after tonight: invoices, invitation emails, two-factor sign-in and password reset, email notifications, minimum-order negotiation, buyer delivery-date requests, offline mode, and the full end-to-end, accessibility and visual suites.

Start: 16:15 SGT. Deadline: 23:00 SGT. That leaves about 6 hours 45 minutes.

"Fully working" here means every feature in scope works end to end against a real database, with real sign-in, real permissions and real stock reservations. Nothing is simulated, and the app is deployed on Vercel with demo accounts. It does **not** mean all 135 stories in `USER_STORIES.md`; the rest of that plan continues after tonight on the same architecture.

## 1. Changes to the agreed process, for tonight only

- No approval stop between phases. You review at the 18:00, 20:00 and 22:00 checkpoints and at the end.
- Hosted Supabase project created through the connected Supabase tool, instead of Docker on your machine.
- A smaller test suite: domain unit tests, plus database tests for permissions, stock reservations and concurrency. The full end-to-end, visual and accessibility suites move to after tonight.
- One branch, small Conventional Commits, pushed once the GitHub repository exists.
- The production deploy still needs your "yes" at the 22:00 checkpoint.

## 2. Scope

### In tonight

| Area | Features | Stories |
| --- | --- | --- |
| Shared | App shell from the prototype (bottom tabs with More, side rail from 760px), home pattern, light, dark and system themes, toasts, empty and error states, sign in and sign out, role routing, audit log, in-app notifications | SH-01 to SH-06, SH-09 (in-app only), SH-11, SH-12, AUTH-01, AUTH-02, AUTH-06 |
| Buyer | Home (To do, Ready for tomorrow, Arriving), Order (usuals, product cards, manual add, typed order read by AI with the rule-based fallback), mandatory review with match status, quantities, kg conversion, stock blockers, substitutes, cut-off and budget warnings, split by supplier, Confirm and reserve stock, CartBar, Orders list, cancel, All here, Report a problem, Not here yet, Availability, Settings (budget, switches, usual items) | BUY-01 to BUY-04, BUY-08 to BUY-17, BUY-20 to BUY-23, BUY-27 to BUY-31, BUY-42 to BUY-46 |
| Supplier | Home, To do, Incoming orders (accept with delivery date, part accept, reject, out for delivery, delivered), answer problems, Inventory (add product, receive stock, change price, adjust), Stock history, Activity, Settings (business profile) | SUP-01 to SUP-07, SUP-09 to SUP-18 |
| Admin | Home, Needs attention (live rules, filters, assign, mark handled), resolve disputes, All orders, Suppliers and profile, suspend and reactivate, Users and buyer details, Operators list, Audit log, Settings | ADM-01 to ADM-05, ADM-07, ADM-09 to ADM-14, ADM-18, ADM-19 |
| Platform | Stock history, row-locked reservations, idempotent actions, state machines, RLS isolation, seeded demo data, health endpoint, deploy | OPS-01 to OPS-05, OPS-08 |

### After tonight (in this order)

1. Invoice upload and checks, with the bank details check, plus credits.
2. Invitations by email: new supplier, buyer business and colleague. Tonight, accounts are seeded.
3. Two-factor sign-in for admins, and password reset by email.
4. Email notifications through Resend.
5. Ask assistant.
6. Insights.
7. Minimum-order negotiation.
8. Delivery-date requests by the buyer. Tonight, the supplier sets the date when accepting.
9. Offline mode and PWA install.
10. The AI evaluation set, the full end-to-end, accessibility and visual suites, and Phase 6 hardening.

Adding a product for a connected supplier works tonight. Inviting a brand-new supplier waits for item 2.

## 3. Timeline (SGT)

| Time | Block | Output |
| --- | --- | --- |
| 16:15 to 16:30 | Kickoff. You do the owner actions in section 4 while I scaffold. | Repo skeleton |
| 16:30 to 17:45 | **Foundation.** Next.js 16 with strict TypeScript; tokens to Tailwind; core UI components; app shell for three roles; Supabase project; migrations for organisations, memberships, profiles, connections, audit log, state transitions, idempotency; RLS helpers; sign in and out; role routing; seed users | You can sign in as each demo account and see an empty shell |
| 17:45 to 18:00 | **Checkpoint 1** | Go, or cut |
| 18:00 to 19:30 | **Catalogue and ordering.** Products, inventory, stock history and functions; Availability; Order page; rule-based reader and AI reader; review; CartBar; `place_orders` with row locks and idempotency; buyer Orders and cancel; reservation and RLS tests | A buyer can place real orders that reserve stock |
| 19:30 to 20:00 | **Checkpoint 2** and fixes | Go, or cut |
| 20:00 to 21:15 | **Supplier and delivery.** Supplier home, orders and every transition, inventory actions, stock history, activity, profile; buyer delivery checks and problems; supplier answers; buyer home To do and Ready for tomorrow | The full buyer-to-supplier loop works |
| 21:15 to 22:00 | **Admin.** Home, attention view, disputes, orders, suppliers with suspend, users, operators, audit log; in-app notifications | Admin can oversee everything |
| 22:00 to 22:15 | **Checkpoint 3.** Your "yes" to deploy to production | Deploy approved |
| 22:15 to 22:45 | Deploy to Vercel; production seed; smoke test on phone and laptop in both themes | Live URL |
| 22:45 to 23:00 | README, demo accounts in `docs/USER_GUIDE.md`, CHANGELOG, handover | Done |

### If a checkpoint shows we are behind
Cut in this order, so the core loop always works:
1. Operators list
2. Admin attention filters and assign
3. Stock adjust
4. Part accept
5. Supplier Activity
6. Ready for tomorrow
7. AI reading (the rule-based reader stays)

## 4. Owner actions, needed by 16:45

These are the only things that can block tonight.

| # | Action | How |
| --- | --- | --- |
| 1 | Install Node 24 LTS | Download from nodejs.org, run the installer, then reopen this app. |
| 2 | Choose the Supabase organisation (a free project is fine tonight) | Tell me its name; I create the project in Singapore with the connected tool. |
| 3 | Create an empty private GitHub repository named `tradelink`, and tell me its URL | github.com, then New repository. Leave "Add a README" unticked. |
| 4 | Connect Vercel to that repository | vercel.com, Add New, Project, Import the repository. I set the environment variables. |
| 5 | Add `ANTHROPIC_API_KEY=...` to `.env.local` in the project folder | Do it yourself. Never paste the key in chat. Without it, the rule-based reader is used. |

The GitHub CLI, Docker, the Supabase CLI and the Vercel CLI are not installed, and tonight's route avoids needing them.

## 5. Reuse from the reference repository

The reference repository ("the reference app", last commit 12 October 2026) is a different product built on a different stack:
- a single shop owner's records, with no supplier or admin roles;
- Vite and Fastify rather than Next.js;
- OpenAI called through `fetch` rather than Claude through the Anthropic SDK;
- RLS policies that let the browser write directly.

Only parts of it fit the brief.

### 5.1 AI: reuse the logic, swap the transport

The AI part is the most reusable piece. Its prompts, schemas and safety checks carry over. Only the call to the model changes, from `fetch` to OpenAI (`server/openai.ts`, about 65 lines) to the official Anthropic SDK with structured outputs (`messages.parse` with a Zod format). The brief requires Claude, and swapping the transport costs about 20 minutes, so keeping OpenAI would not save time.

| Their AI piece | What it does | Tradelink feature | When |
| --- | --- | --- | --- |
| `extractOutletOrder` prompt and schema (`server/whatsappOrder.ts`) | Reads informal, mixed-language orders ("tmr", "esok", "明天") into lines matched only to the outlet's own items. Never invents quantities or items. Treats the message as data. | `readOrder`: matches only the buyer's connected catalogue (BUY-10, AI-01, AI-02, AI-04) | Tonight |
| `groundExtractedOrder`, `hasOrderQuantity`, `hasOrderUnit`, `groundRequestedDate` | Checks every item, quantity, unit and date the model returns against the words actually typed. Anything not supported becomes a line to check. | Review line states "Matched", "Check this", "quantity assumed" (BUY-14, BUY-15, AI-03, AI-04) | Tonight |
| `validateOutletOrder` | Splits by supplier and checks delivery days, lead time, cut-off and duplicate matches across suppliers | Review summary blockers and cut-off lines (BUY-20, BUY-21) | Tonight |
| Versioned drafts (`version` checked on confirm, stale confirms rejected) | Stops a stale review being confirmed after another change | `place_orders` checks the draft version (BUY-22) | Tonight |
| Its order tests (`tests/chat-order.test.ts`, `tests/whatsapp-order.test.ts`) | About 300 lines of cases | `src/domain/reader/*.test.ts` and the start of the evaluation set (AI-06) | Tonight |
| `classify` intent router: regex fast paths, then the model | Tells an order from a question, "usual" and "repeat last order" | Ask routing (BUY-47 to BUY-49) | Stretch tonight, otherwise first after tonight |
| Agent team plus its account agent reads: account-scoped facts with IDs, an answer that must cite fact IDs, and an independent reviewer | Grounded answers with no invented numbers; off-topic guard | Ask answers, with reads through the buyer's own session (BUY-48, BUY-50). Simplified from five model calls to two (plan, then answer with citations) for speed | Stretch tonight, otherwise first after tonight |
| `invoiceDraft` schema and photo extraction (`server/liveAi.ts`) | Reads supplier, invoice number, date, lines and prices from a photo into an editable draft | `readInvoice` (BUY-32 to BUY-36, AI-07) | After tonight |
| AI quota (its AI usage table, 30 per account per hour) | Limits cost and abuse | `ai_usage` and rate limits (AI-05, OPS-07) | Tonight |

Adapting these pieces to Tradelink:
- `itemId` matching becomes `productId` matching against `v_catalogue`.
- Pack units map to Tradelink units, and the kg-to-pack conversion stays in the domain layer.
- "Owner" becomes the buyer organisation, and every read uses the buyer's own session, so RLS applies.
- Their code is very compact. I will reformat it into small, readable functions to meet the brief's standards.

### 5.2 Other reuse

| Piece | Tradelink feature | When |
| --- | --- | --- |
| Supabase sign-in screen flow (`src/live/AuthScreen.tsx`), restyled to the Tradelink design | AUTH-01 | Tonight |
| Invoice photo capture UI (`InvoiceCapture.tsx`) | BUY-32 | After tonight |

### 5.3 Not reused

| Piece | Why |
| --- | --- |
| Data model and RLS | Built for a single owner per account. Tradelink needs buyer, supplier and platform organisations, trading connections and reservations, with writes only through database functions. |
| UI and branding | The reference app's brand. Tradelink must match its own approved prototype. |
| AI actions that change records | Tradelink's AI never writes; people confirm every change. |
| WhatsApp webhook | Out of scope. |

### 5.4 Net effect

About 1.5 to 2 hours saved. AI order reading with grounding is now certain for tonight, not at risk. If checkpoint 2 at 20:00 is on time, a lean Ask (order routing plus grounded answers) joins tonight's scope in the 21:15 to 22:00 block, and admin extras (operators list, attention filters) move after tonight.

The repository has no licence file. I am assuming it is yours to reuse; tell me if it is not, and I will use it as a reference only.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Owner actions are late | I build and test locally against the hosted database; deploy waits |
| A block overruns | Cut list above; checkpoints every 2 hours |
| AI key missing or the API fails | Rule-based reader, as in the prototype |
| A production problem near 23:00 | Vercel preview URL as a fallback demo link |
