# Changelog

All notable changes are listed here. The format follows Keep a Changelog, and versions follow semantic versioning.

## [Unreleased]

### Changed (design language: "calm app, living AI")
- **The whole app:**
  - A neutral canvas with white cards and fine borders.
  - One brand green, kept for actions and key numbers. Status colours are flat: blue for in progress, amber for attention, red for problems.
  - Smaller corners and lighter type weights. Section tabs sit in the top bar with an underline; phone tabs mark the current one with a bar.
  - Figures sit together in one divided card.
  - Products use a quiet grey ground and outlined Add buttons.
  - Sign-in and the password pages use the same calm look.
- **The AI layer:** a green gradient (deep green, emerald, teal, lime) marks only what Tradelink AI wrote or suggests. That covers the greeting, the ask bar, the Next up card, the spark icon, the Tradelink AI page and its input. "Why this?" shows the reasoning on a soft tint, and the ring drifts slowly unless motion is turned off.
- **Home, one focus at a time:**
  - **Buyer:** a briefing line written from the data and an ask bar that opens Tradelink AI with the question. One Next up card, usually tomorrow's order, with Place orders (the cart stays as it is), Review in cart and Not today. Then a week card with spend, pace to Sunday and the comparison with this time last week, and an At a glance card (deliveries, running low, prices).
  - **Supplier:** a cut-off countdown. Next up is the oldest job first: accept new orders, or pack today's orders as one pick list added up across orders, with Mark all out for delivery. Then today against a usual weekday (order value and new orders by this time over the last four weeks), and At a glance (customer pulse, running low, coming up).
  - **Admin:** the attention queue first, then the figures.
- **Removed:** the green home banner, service tiles and stat cards. "My usual" is now **Add my usual** in the cart.

### Added
- **Order now:** "order one bag of rice now" shows one confirm card that orders only that item and leaves the cart as it is. When several products match, Tradelink AI picks the likely one and offers the other as a follow-up. Product cards also have an Order now button, which needs a second tap.
- **More supplier actions in Tradelink AI:** accept part of an order (Change quantities on the order card, down to 0 for a line), confirm the price and stock of a product a buyer added, adjust stock with a reason (damaged, expired or count correction), and change cut-off, delivery days, lead time and minimum order. Each shows a confirm card or works from its card's own buttons.
- **New products and suppliers from chat:** buyers get a filled-in form card to add a product, and to add a supplier who is not on Tradelink yet, either with the product or on its own. Suppliers get a form card to add a product with opening stock and a reorder level. Nothing is added until the person taps the card's button. The database function `buyer_add_supplier` is new.

### Changed
- **One navigation for every role:** suppliers and admins now have the buyer's layout. On laptop there is no side rail and the section titles sit in the top bar; on phone, suppliers get five bottom tabs. Settings is in the account menu for everyone, and admin Notifications is reached from the bell. Stock history sits under Inventory, with a link on that page.
- **Tradelink AI looks like the rest of the app:** a page title and description, the chat and the history in the same bordered panels as other pages, suggestions styled like the home tiles, the standard input and Send button, and no gradient glow.

### Fixed
- **Account menu on Safari:** Settings and Sign out now work. Safari does not focus a tapped button, so the menu closed before the tap landed.

### Changed (Tradelink AI)
- **Cart card:** lines are grouped by supplier with subtotals, and each line has minus and plus buttons. Lines asking for more than is in stock are marked, with a one-tap fix. Place order shows the total and stays off until every line is fixed. Long carts expand in place.
- **Waiting:** one avatar while Tradelink AI works, with the progress line inside its reply.
- **Follow-ups:** never offer what a card already lets the person do.

## [0.6.0] - 2026-11-03

### Added
- **Tradelink AI for buyers and suppliers:** a Claude agent that uses the same actions as the app, replacing the fixed-phrase Assistant. It looks things up itself in several steps, streams its answer, and shows order cards.
  - **Buyers:** find products, orders, cart, spend, alerts, usual items and suppliers. Every change shows a confirm card first and runs only on the person's tap, through the same database functions as the screens: add to cart, change the cart, place the order, cancel, All here, Not here yet, report a problem, acknowledge a price change, mark a credit received, set the budget, and change usual items.
  - **Suppliers:** new and accepted orders, inventory and low stock, problems and terms, with the same confirm cards for accept, reject, out for delivery, delivered, answer a problem, receive stock and change a price.
  - **Where it lives:** `/supplier/assistant` is new, and Tradelink AI is in both navigations and on both home pages.
- **Foundations for the larger Tradelink AI build** (from M0): database tables, the card system, timed jobs, notifications, the installable app shell and the offline outbox. Most of this is not visible yet.

## [0.5.0] - 2026-11-03

### Changed (buyer, second round of owner feedback)
- **Navigation:** on laptop there is no side rail. The section titles sit in the top bar on every page except Home, whose tiles lead to them. Phone keeps the bottom tabs, now five with no More.
- **Settings:** removed from the nav. It is in the account menu with Sign out, for every role. The Home Settings tile is now Cart.
- **Alerts:** the bell opens a pop-up with "Needs your action" and the latest updates. Each update, and each alert about an order, has an arrow to that order.
- **Tradelink Assistant:**
  - A green gradient look, with chat history kept in the browser and a New chat button.
  - The message box is focused when the page opens.
  - Cart requests such as "place an order for items in my cart" show the cart with a Place order button that the buyer taps. The assistant still never places an order on its own.
- **Home:** rounder corners on the tiles, summary cards and panels.

## [0.4.0] - 2026-11-03

### Changed (buyer redesign, owner feedback)
- **Look and font:** Inter across the app, with a cleaner, simpler layout.
- **Top bar:** on every page, with the theme toggle, the alerts bell, the cart icon and a user menu with Sign out (also on the sidebar logo).
- **Ordering:** happens in the chat-style **Tradelink Assistant** (renamed from Ask) and in **Products**, which has illustrated pictures and add-to-cart steppers. The new **Cart** page is where you review and place orders. The separate Order page and the Alerts tab are gone.
- **Orders:** compact rows with filters, counts and search, a detail page per order, and problems explained and clickable.
- **Home:** centred icons, each summary card going somewhere different, and no To do panel. Actionable alerts moved to the bell.
- **Insights:** a colour-coded dashboard with trends, budget progress, spend by supplier and supplier ratings.
- **Settings:** split into App settings and Shop settings, with a tidy usual-items table. The Appearance section and "What Tradelink can do" are removed.

## [0.3.0] - 2026-11-03

### Added
- **Create an account**: buyers and suppliers can sign up themselves. New accounts are connected to active businesses of the other kind (ADR 0024).
- **More mock data**: extra businesses, accounts and orders in every state, for testing (`supabase/mock-data.sql`).

### Removed
- **Two-factor sign-in**, removed for now by owner decision (ADR 0024). Existing demo enrolments were removed.

## [0.2.0] - 2026-11-03

### Added
- **Ask Tradelink**: answers about orders, deliveries, spend, prices and suppliers from the buyer's own data. Typed orders go to review. Open questions are answered by Claude from cited facts (ADR 0023).
- **Insights**: weekly spend, spend by supplier, each supplier's on-time record and price changes.
- **Password reset**: "Forgot your password?" sends a single-use link that leads to setting a new password.
- **Two-factor sign-in for admins**: an authenticator app (TOTP) is required. The database refuses admin access to any session without two-factor (`aal2`).

### Fixed
- Products on a business's own orders stay visible after the product is hidden.
- The admin home, suppliers and users pages loaded inviting organisations with a query Supabase does not support, which broke them in production.
- Claude read failures are now logged with their error type and status.

## [0.1.0] - 2026-11-03

### Added
- **Shared**:
  - Sign in and sign out, with routing by role and blocked attempts recorded in the audit log.
  - App shell matching the prototype: bottom tabs with More on phone, side rail from 760px.
  - Light, dark and system themes; in-app notifications for every role; toasts; empty and error states.
- **Buyer**:
  - Home with To do, Ready for tomorrow and deliveries to check.
  - Ordering by typed text (read by Claude Sonnet with grounding checks and a rule-based fallback), usual items, product cards or manual entry.
  - Mandatory review with match states, substitutes, cut-off and budget warnings.
  - Confirm and reserve stock, split into one order per supplier.
  - Order tracking with All here, Report a problem and Not here yet.
  - Availability, and settings with usual items.
- **Supplier**:
  - Home and To do.
  - Incoming orders with accept (with delivery date), part accept, reject, out for delivery and delivered.
  - Answers to problems: credit, replace, update or dispute.
  - Inventory with add, receive, confirm, change price and adjust.
  - Stock history, activity and an editable business profile.
- **Admin**:
  - Home and Needs attention, built from live rules, with filters, assignment and dispute resolution.
  - All orders, suppliers with suspend and reactivate, users, buyer details, operators, audit log and settings.
- **Platform**:
  - Supabase schema with Row Level Security on every table.
  - Writes only through Postgres functions, with row locks and idempotency keys.
  - Explicit state machines, an append-only stock history and audit log, and fictional demo data.
  - Health endpoint.
  - Opt-in concurrency test proving that reservations never oversell.
- **Documentation**: Phase 0 discovery, Phase 1 architecture, data model, API, security, user stories, test plan, implementation plan, 22 ADRs, README and user guide.
