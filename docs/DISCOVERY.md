# Phase 0: Discovery

Status: draft for review, 3 November 2026.
Scope: an inventory of every screen, action, state and rule in the approved prototype, what is simulated, gaps found, assumptions and open questions. No application code has been written.

## 1. Sources and how they were checked

| Source | Result |
| --- | --- |
| `design-handoff/README.md` | Read. |
| `design-handoff/prototype.html` | Read in full: 1,704 lines of CSS, data and logic. Every inventory item below traces to a function in this file. |
| `design-handoff/design-system/README.md`, `tokens.json`, `components/*` (21 components and `bundle.css`) | Read. |
| `design-handoff/logos/` | Read: `tradelink-logo-green.svg`, `tradelink-logo-white.svg`, `tradelink-app-icon.svg`. |
| Published prototype (`XixvU33u8KhAvmLdrB7eSH`) | Read through the artifact API. Identical to the local file apart from the closing tags. |
| Published design system (`36C45mDvfSeHekEjg2p5qB`) | File list checked. README, tokens, component READMEs and `bundle.css` match the local copies byte for byte. |
| Browser walkthrough | Partial. The built-in browser pane is about 450px wide and clears custom viewport sizes, local files always render in light mode, and the published copy needs a claude.ai sign-in. The phone layout was checked visually. The tablet, laptop and dark-mode layouts were checked from the CSS. A full visual comparison is planned for Phase 6, using Playwright screenshots at 390, 820 and 1280px in both themes. |

## 2. App shell and navigation

### 2.1 Layout

| Element | Phone (below 760px) | Tablet and laptop (760px and up) |
| --- | --- | --- |
| Top bar | Brand mark and the `tradelink` wordmark (Sora 600, -0.04em), the org logo and name, and ThemeToggle. Hidden on home pages, where HomeHero takes its place. | Sits at the top of the 228px rail. Org name hidden. |
| Navigation | BottomNav: the first 4 items plus More when a role has more than 5 items. More opens a bottom sheet (scrim, `radius-sheet`), with counts carried on the More tab. | White side rail listing every item. Active item uses `accent-soft`. |
| "Who" block | Hidden | Bottom of the rail: user logo, name, org and role. |
| CartBar | Above the bottom nav | Under the main column |
| Toast | Fades after about 3.2s. `role="status"`, `aria-live="polite"`. Moves up when CartBar shows. | Same |
| Content | `space-14` padding. Pages max 1060px wide. | `space-24` padding |

Layout breakpoints, as container widths: 620px (stats and tiles go from 2 to 4 across, product grid to 3), 640px (stacked records), 760px (side rail, ServiceGrid in one row of 8), 860px (`.cols` in two columns), 980px (order review gets a 300px side summary, product grid 4 across, attention cards 2 across).

### 2.2 Navigation items by role

| Role | Bottom tabs (phone) | Under More (phone) | Counts |
| --- | --- | --- | --- |
| Buyer | Home, Order, Ask, Orders | Insights, Availability, Settings | none |
| Supplier | Home, Orders, Inventory, Activity | Stock history, Settings | none |
| Supplier (invited, not joined) | no navigation; only the invitation page | | |
| Admin | Home, Attention, Orders, Suppliers | Notifications, Users, Operators, System status, Audit log, Settings | Attention (open items), Notifications (unread) |

### 2.3 Theme

ThemeToggle in the top bar, the rail and the phone HomeHero. Its `aria-label` names the mode it switches to. Settings has Appearance with System, Light and Dark. The prototype stores this in `localStorage` (`tradelink-theme`). Dark mode uses neutral charcoal tokens.

## 3. Screen inventory

Layout key: each line gives the sections in screen order, with **actions** in bold and the empty states quoted.

### 3.1 Shared: home pattern (`homeShell`)

HomeHero (gradient `hero` to `hero-2`, logo 44px, "Good morning/afternoon/evening, {first name}", business name, ThemeToggle on phone, search-style prompt), then the ServiceGrid of 8 tiles overlapping the hero, with a red count only when action is needed. Then 4 StatCards (each links to detail; alert variant uses `warn`), then a body.

### 3.2 Buyer

**B1 Home (`vToday`)**
- Hero prompt: "What do you need to order?" opens Order.
- Services: My usual (loads usuals into review), New order, Ask, Track (count = deliveries to check), Invoices (count = invoices needing review or "Do not pay yet"), Insights, Availability, Settings.
- Stats: Spent this week; Left of budget (alert when over); Deliveries to check; Things to do (alert when more than 0).
- To do panel (TodoItem with tone and a single action), sorted by the prototype's generation order:
  - Price change on a usual item (warn if up, good if down): "{product} went up 6.0%", "S$8.90 to S$9.40 at {supplier}." **OK, noted**.
  - Part delivery (warn): "{supplier} can only send {n} of {m}". **Order the other {m−n}** (primary) or **Skip**.
  - Supplier reply to a problem (good, or bad if disputed). Copy differs by status. **OK**.
  - Invoice too high (warn): "Invoice {no} is S$x too high". **Query supplier** (primary) or **Accept**.
  - Changed bank details (bad): "Do not pay {no} yet", "It shows a new bank account ending {4}. Phone {contact} on {phone} before paying." **I confirmed by phone**.
  - Empty: "You are all caught up."
- Ready for tomorrow panel: plan total, rows with ProductArt, "{n} days left", ", only {n} available" when short, and the quantity with unit. Cut-off line per supplier. **Review and send** (primary) or **Not today**. Empty: "You have enough stock for the next few days."
- Arriving and to check: OrderCards for orders that are out for delivery, or delivered and not yet checked.

**B2 Order (`vNew`), compose mode**
- Header: "Order" / "Type it the way you would text a supplier, or tap your usuals."
- Panel "Type or paste your order": monospaced textarea. **Read my order** (primary; while busy shows "Reading your order..."), **Use my usual**, **Add items manually**.
- "Your usuals": horizontal ProductCard scroller with **Add all**. Each card has **+** (adds 1, disabled when out of stock) and a "{n} in order" pill.
- Error toast: "No items found. Add a quantity and a product name."

**B3 Order, review mode (mandatory before sending)**
- "Review {n} lines" with **Add more items** (back to compose).
- One line card per line: the source text in mono, a status Pill, a product picker ("Best matches" first, then "All products", each with price), a quantity stepper (min 1), an info line, and **Remove**.
  - Line states and pills: Matched (good), Check this (warn; "More than one product fits. Choose the right one."), Not in catalogue (bad; "No match found. Add it to the catalogue, choose a product, or remove this line." plus **Add to catalogue**), Added to catalogue (info), Suggested (info), Added by you (info).
  - Info line: "{qty unit} · S$ · {n} available · {supplier}". Optional parts: "estimated · stock to be confirmed", "waits for supplier to accept invitation", "{x}kg rounded to full bags", "quantity assumed", and in warn "you last paid S$x".
  - Over stock (bad border): "Only {n} available. Reduce the quantity." plus **Use {substitute} instead** when one exists.
  - Inline "Add to catalogue" form: Product name, Sold by (unit), Estimated price (S$), Supplier (active or invited, or "Add a new supplier"). A new supplier adds Supplier name, Contact person, Phone, Email and Address (optional), with the note "We will email this supplier an invitation link…". **Add to catalogue** or **Cancel**.
- "Add another product" select (each option shows availability or "stock to confirm").
- Aside "Order summary", or "Splits into {n} orders": subtotal per supplier, "Total before GST", a cut-off line per supplier, the budget warning "This takes your week to S$x, above your S$y budget.", blockers ("Choose a product for {n} lines.", "Reduce {n} items to the stock available."), **Confirm and reserve stock** (disabled while blockers remain), and the note "Nothing is sent or reserved until you confirm. Stock is checked again at that moment."
- Empty: "Add a product to start this order." Toast on success: "{n} orders placed and stock reserved."

**B4 Orders and invoices (`vOrders('buyer')`)**
- Segmented control: Orders | Invoices.
- Orders: "Open problems" (IssueCards) above OrderCards.
- OrderCard: supplier logo, name, mono order ID and status Pill; item rows (ProductArt 26px, "qty × name", tag "Stock and price to confirm" when not held, line total); ProgressSteps (Placed, Accepted, Out for delivery, Delivered; hidden when rejected or cancelled); footer with time, total and a check Pill (All here, or Problem reported).
- Buyer actions: Pending gets **Cancel order**. Out for delivery gets **All here**, **Report a problem** and **Not here yet**. Delivered and unchecked gets **All here** and **Report a problem**.
- Report a problem form: Item, What happened (Short, Damaged, Wrong item, Expired), Quantity affected, Note (optional). **Send to supplier** or **Cancel**.
- Empty: "No orders yet."

**B5 Invoices tab (`vInvoices`)**
- "Check an invoice". The prototype offers 4 sample buttons; the real app uploads a photo or PDF. Note: "Tradelink checks invoices. It never makes payments."
- Invoice cards: mono invoice number and status Pill; supplier, order and total; "Expected from your order"; flags ("Higher price: …", "Unexpected fee: …"); bank-change line "New bank account ending {x}. Saved account ends {y}."
- Credits panel (only when credits exist): supplier, order, amount, and **Mark as received** or "Received".

**B6 Ask (`vAsk`)**
- "Ask Tradelink" / "Order in your own words or ask about your shop." A chat thread, with "Thinking..." while waiting.
- Suggestion chips: What should I order? / What's arriving today? / How much did I spend this week? / How much is cooking oil? / Which supplier is most reliable? / "2 ctn eggs and 5 tins evaporated milk".
- Intents and replies: refuses to share other shops' data; looks up an order by ID (shows an order card); spend vs budget (**Open Insights**); arrivals (order cards); what to order (plan, **Review and send**); usuals (**Load my usual**); most reliable supplier (**See all suppliers**); price lookup (supplier, available, "You last paid"); parses an order ("Here is what I read. Nothing has been sent.", **Review order**); fallback help text.
- Composer: input and **Send**, with Enter to send.

**B7 Insights (`vInsights`)**
- Tiles: Spent this week; Left of {budget} budget; Overcharges caught; Price changes.
- Weekly spend bars (4 earlier weeks plus this week); Spend by supplier as horizontal bars; Supplier record cards (On time %, Problems, Cut-off); Price changes feed. Empty: "No price changes on your usual items."

**B8 Availability (`vCatalogue`)**
- "All {n} catalogue products, including items that are out of stock." Search, then category Chips (All, Fresh, Dry goods, Oils and sauces, Supplies), then a ProductCard grid. Pills: Stock to confirm, Out of stock, Only {n} left, {n} available. Empty: "No products match your search."

**B9 Settings (`vSettings`)**
- Appearance; Weekly budget ("Warn me above this amount (S$)"); Alerts and suggestions switches (Suggest what to reorder, Tell me about price changes, Warn me before I go over budget); "What Tradelink can do" (can / cannot lists); My usual items records with an editable "In your shop", Use per day and Days left.

**CartBar (buyer, every screen except review)**: "{n} items", total, **View order**.

### 3.3 Supplier

**S1 Home (`vSupplierHome`)**
- Hero prompt: "Find a product in your inventory".
- Services: Orders (count = pending), Inventory (count = low), Add product, Problems (count = open issues), Deliveries, Stock history, Activity, Settings.
- Stats: New orders (alert), To deliver, Open order value, Low stock products (alert).
- To do: problems to answer ("Late delivery / Invoice query / {type} item on {order}", **Answer**), "Confirm stock for {product}" (**Confirm**), "{product} is low/out of stock" (**Receive stock**).
- Recent activity: the latest 2 items, with **See all**.
- New orders: OrderCards. Empty: "No new orders right now."

**S2 Incoming orders (`vOrders('supplier')`)**
- "Only orders for {org} appear here." "Problems to answer" (IssueCards) above the orders.
- Actions: Pending gets **Accept order**, **Part accept** and **Reject**. Accepted gets **Mark out for delivery**. Out for delivery gets **Mark delivered**.
- Part accept form "How much can you send?": one 0..qty field per line. **Send part order** or **Cancel**. All zeros means reject.
- IssueCard actions: **Credit S$x** (when amount > 0); **It is on the way** (Late); **Replace next delivery** (not Late or Invoice); **Dispute**, or for invoices **Invoice is correct**.

**S3 Inventory (`vInventory`)**
- Tiles: Products, Units on hand, Units reserved, Need reordering (alert).
- Search ("Search name or SKU"), **Low stock only** chip, **Add product**.
- Add a product form: Product name, Sold by, Price (S$), Opening stock, Reorder at. Note: "Buyers can see and order this product as soon as you add it."
- Records (OrderCard layout): ProductArt, name, mono SKU, health Pill (Healthy, Low stock, Out of stock, Stock unconfirmed), stock bar, metrics (Price, On hand, Reserved, Available, Reorder at). Actions **Receive stock** (or **Confirm stock**) with an inline quantity field, and **Change price** with an inline field.
- Empty: "No products match this view."

**S4 Stock history (`vHistory`)**: records with ProductArt, name, time, movement Pill (Received good, Reserved info, Released plain, Delivered warn), Units (signed) and Source. Empty: "No stock changes yet."

**S5 Activity (`vActivity`)**: a feed of audit entries involving the org, with a "Blocked" pill on denied attempts. Empty: "No activity yet."

**S6 Settings (`vSupplierSettings`)**: Appearance; a read-only Business profile (business, contact, phone, email, address, range, delivery days, lead time, minimum order, order cut-off).

**S7 Invitation (`vInvite`)**: "You're invited to Tradelink" / "{buyer} wants to order from {org} here." A "Waiting for you" panel (orders waiting, products with estimated prices). **Accept invitation** or **Decline**.

### 3.4 Admin

**A1 Home (`vOverview`)**
- Hero prompt: "Find a supplier".
- Services: Attention (count), Alerts (count = unread), Orders, Suppliers, Users, Operators, System (count = degraded services), Audit log.
- Stats: Need attention (alert), Open orders, Open order value, Active suppliers.
- Panels: Needs attention (top 2, **See all**); Recent activity (2); Low stock (2, **See all {n}**); Platform (services status, operators online, unread alerts).

**A2 Needs attention (`vAttention`)**: tiles (High priority, Medium priority, Assigned, Unassigned); chips (All, High, Medium, Unassigned); AttentionCards with type icon, type, priority Pill, title, detail, actions and an "Assigned to" operator select. Empty: "Nothing here right now." The item rules are in section 6.6.

**A3 Notifications (`vNotifications`)**: **Mark all as read**; cards with a kind Pill, time, "New" when unread, text and **View supplier**. Kinds: Invitation sent, resent, accepted or declined; Dispute opened; Bank details changed.

**A4 All orders (`vOrders('admin')`)**: OrderCards titled "{buyer} to {supplier}", with no actions (read only).

**A5 Suppliers (`vSuppliers`)** and **A6 Supplier profile (`vSupplierDetail`)**: records (logo, name link, contact, status Pill, Products, Low stock, Open orders). The profile has **Back to suppliers**, a logo 48px, name and status, then an action (**Resend invitation**, **Suspend** or **Reactivate**). Tiles: Products, Low stock, Open orders, Order value. Then the Profile, Shop products and Orders sections.

**A7 Users (`vUsers`)** and **A8 Buyer details (`vBuyerDetail`)**: Buyers records (link, contact, address, phone, email, open orders, order value) and All accounts (role, access summary). Buyer details shows the profile, totals and orders.

**A9 Operators (`vOperators`)**: records (name, team, status Online, Away or Offline; shift; assigned items). The "Add an operator" form takes Name, Team (Order desk, Supplier onboarding, Customer support) and Shift.

**A10 System status (`vStatus`)**: a header pill ("All services operational" or "{n} services degraded"); AI tiles (Messages read, Lines read, Matched automatically %, Sent to buyer to check); service records (30-day uptime, Response). Services: Web app, API, Database, AI order reader, Email notifications, Nightly backup.

**A11 Audit log (`vAudit`)**: records (org logo, action, who, role, time, and an Allowed or Blocked Pill).

**A12 Settings (`vAdminSettings`)**: Appearance and Account (name, team, role, email).

## 4. Domain model found in the prototype

| Entity | Fields used | Notes |
| --- | --- | --- |
| Account / organisation | org name, contact name, role, status, phone, email, address, joined, hours (buyer); range, delivery days, lead time, min order, cut-off hour, bank last 4, on-time % (supplier); invitedBy, invitedAt | The prototype puts user and organisation in one record. The real model splits them. |
| Product | supplier, SKU, name, unit, price, onHand, reserved, reorder level, aliases, packKg, unconfirmed, hidden | Category and art type are derived from the name by regex. |
| Order | ID, buyer, supplier, status, created, lines (product, qty, price at order time, held), delivery check | |
| Stock movement | time, product, type, change, source | Types: Received, Reserved, Released, Delivered. |
| Usual item | product, usual qty, use per day, "have" in the shop, last price paid | Per buyer. |
| Issue | ID, order, supplier, buyer, product, type, qty, amount, note, status, time, seen | Types: Short, Damaged, Wrong item, Expired, Late, Invoice. |
| Invoice | number, order, supplier, total, expected, flags, bank last 4, bankChanged, status | |
| Price change | product, old, new, time, status | |
| Part acceptance | order, product, sent, asked, status | |
| Notification | time, kind, text, supplier, read | Admin only in the prototype. |
| Attention assignment, dismissals | item key, operator | |
| Operator | name, team, shift, presence | |
| Service health | name, status, uptime, response | |
| Audit entry | time, actor, org, role, action, flag (denied), related orgs | |
| Buyer settings | weekly budget, 3 toggles | |
| AI usage stats | messages, lines, matched, flagged | |

ID formats: `ORD-1042`, `INV-301`, `ISS-301`, `PC-1`, `PA-1`; SKU `DG-1001` (supplier), `SP-…` (supplier-added), `NEW-…` (buyer-added).

## 5. State machines in the prototype

**Order** (`advance`, `allHere`, `saveProblem`, `declineInvite`)
```
Pending ──accept / part accept (supplier)──▶ Accepted ──supplier──▶ Out for delivery ──supplier, or buyer "All here" / "Report a problem"──▶ Delivered
   │──reject (supplier) or all-zero part accept──▶ Rejected
   │──cancel (buyer)──▶ Cancelled
   └──supplier declines invitation (system)──▶ Cancelled
Delivered check: unchecked ──All here──▶ ok | ──Report a problem──▶ issue
```
Invalid or unauthorised transitions are refused and written to the audit log as "denied".

**Issue**: Open → Credit promised, Replacement promised, Supplier replied (Late only) or Disputed (supplier). Disputed → Credit promised or Closed (admin). Credit promised → Credit received (buyer). A buyer can file only one open Late issue per order.

**Invoice**: (checked) → Matched, Needs review or Do not pay yet. Bank change takes priority. Needs review → Query sent (creates an Invoice issue) or Accepted. Do not pay yet → Cleared by phone.

**Supplier account / invitation**: Invited → Active (accept) or Declined (decline). Invited → Invited (resend refreshes the time). Active ↔ Suspended (admin).

**Smaller ones**: Price change New → Seen. Part-acceptance notice New → Added or Skipped. Notification unread → read. Attention item open → handled (dismiss, for System and Blocked action only; other items close when their cause clears).

## 6. Business rules and calculations

### 6.1 Stock
- Available = on hand − reserved. Health: unconfirmed; out if available ≤ 0; low if available ≤ reorder level; otherwise healthy.
- Stock bar = available ÷ (2 × reorder level), with a minimum width of 3%.
- Placing an order reserves stock for confirmed products only. Unconfirmed products are "not held".
- Reject, cancel and decline release reserved stock. A part accept releases the difference.
- Delivered: on hand −qty and reserved −qty.
- Receive: whole number 1–9999. Receiving an unconfirmed product confirms it and sets the reorder level to 5 if none is set.
- Opening stock is recorded as a "Received" movement with source "Opening stock".

### 6.2 Ordering
- The order reader splits text on new lines, commas, semicolons, "and" and "&". It strips filler words and units, picks up the quantity (default 1, marked "quantity assumed") and rounds it up to a whole number.
- Matching: an alias found in the text scores 1. Otherwise the score is token overlap × 0.9. Candidates need at least 0.45. A line is Matched only when the top score is at least 0.85 and not tied; otherwise it is Check this, or Not in catalogue when there are no candidates.
- kg conversion: quantity in kg ÷ pack kg, rounded up to full packs.
- Lines for the same product are merged. Review splits orders by supplier, and each order gets its own ID.
- Confirming is blocked while any line is unresolved, any line exceeds availability, or there are no lines. Stock is checked again at confirm.
- Substitute: another confirmed product that shares a name word and has enough stock.
- Price warning when the current price is more than 102% of the last price paid.
- Budget warning when the week's spend plus this order exceeds the budget (if the toggle is on).
- Cut-off: "Order by {hh}:00 for tomorrow". After the cut-off: "Past cut-off, earliest delivery is the day after tomorrow". Default 16:00.
- The order line price is fixed at order time.

### 6.3 Ready for tomorrow (reorder plan)
- Only when "Suggest what to reorder" is on. Includes usual items where days left = (in shop + on open orders) ÷ use per day is below 3, not skipped today, and still in the catalogue.
- Quantity = min(max(1, ⌈7 × use per day − in shop − on order⌉), max(1, available)). This covers about a week.
- "Not today" skips the current plan items.

### 6.4 Delivery checks and problems
- All here updates the buyer's shop counts. Report a problem updates them less the affected quantity. Quantity must be 1 to the line quantity.
- Problem amount = quantity × the line's order price. The supplier's credit equals that amount.
- Not here yet raises a Late issue (at most one open per order).

### 6.5 Invoices
- Flags: Higher price (amount over expected), Unexpected fee (fee not in terms), Bank details changed (last 4 differ from the saved ones).
- Overcharges caught = sum of flag amounts + promised and received credits.
- A "Bank details changed" result sends a notification to admins and an attention item.

### 6.6 Admin attention rules
| Type | Priority | Rule | Actions |
| --- | --- | --- | --- |
| Supplier invitation | Medium | Invited more than 24h ago | Resend invitation, View supplier |
| System | High | A service is not operational | System status, Mark handled |
| Dispute | High | Issue is Disputed | Credit buyer, Close with no credit |
| Security | High | Invoice in Do not pay yet | View supplier |
| Delivery problem | Medium | Issue open for more than 4h | View supplier |
| Stock | High | Product out of stock | View supplier |
| Order | Medium | Pending for more than 30 min with an active supplier | View supplier |
| Catalogue | Medium | Buyer-added product not confirmed by an active supplier | View supplier |
| Stock | Medium | Product low | View supplier |
| Security | Medium | Blocked action in the audit log | Audit log, Mark handled |

Sort high before medium. The admin home shows the first 2.

### 6.7 Insights
Week spend excludes rejected and cancelled orders. Spend by supplier covers the buyer's non-cancelled orders. The supplier record lists active suppliers the buyer has ordered from, with on-time %, problem count and cut-off.

### 6.8 Validation copy (keep word for word)
"Enter a product name." · "This product is already in the catalogue. Choose it from the list." · "You already have a product with this name." · "Enter a price above 0." (price must be > 0 and ≤ 99,999) · "Choose a supplier or add a new one." · "Enter the supplier name and contact person." · "Enter a valid supplier phone number." · "Enter a valid supplier email." · "This supplier already exists. Choose it from the list." · "Enter opening stock as a whole number." · "Enter the reorder level as a whole number." · "Enter a whole number between 1 and 9999." · "Enter a whole number from 1 to {n}." · "Enter 0 to {n} for {product}." · "Enter the operator name." · "You do not have access to do that." · "Check the highlighted lines before placing this order." · "You have already reported this order as late." · "Invoices are checked against a delivered order. You have none yet."

### 6.9 Confirmation copy (toasts)
"{n} orders placed and stock reserved." · "{ORD}: accepted." (and the same pattern for each status) · "{ORD} part accepted. The buyer has been told." · "Added {n} to {product}." · "Price updated. Buyers who order this item will be told." · "{name} added. Buyers can now order it." · "{name} added. Invitation sent to {supplier}." · "{ORD} checked. Your stock is updated." · "Problem sent to {supplier}." · "{supplier} has been asked for an update." · "{buyer} has been told." · "Dispute resolved." · "Credit recorded." · "Query sent to {supplier}." · "Invoice matches your order." · "This invoice does not match your order." · "New bank details found. Do not pay yet." · "Welcome to Tradelink, {supplier}." · "{supplier} declined the invitation." · "Invitation resent to {supplier}." · "{supplier}: suspended." · "Skipped for today." · "{product} added."

## 7. Simulated in the prototype, real in the product

| Prototype | Real implementation |
| --- | --- |
| "View as" role switch, supplier picker, screen size switch, Reset demo, "Example data" | Removed. Supabase Auth sign-in, roles from membership, a seeded demo for each role. |
| No sign-in or password reset screens | New screens built from the design system: Sign in, Forgot password, Set new password, Accept invitation and set password. |
| Rule-based order reader | Claude through a server-only module: structured output, Zod validation, catalogue-scoped matching, rule-based fallback on timeout. |
| Rule-based Ask | Claude with read-only tools scoped to the buyer's organisation. |
| Sample invoice buttons | Upload a photo or PDF to Storage, extract with Claude, compare with the order, agreed prices and saved bank details. |
| Invitation page standing in for an email link | Email with a single-use, expiring, hashed token, and a public accept/decline route. |
| In-memory state, `setTimeout` | Postgres with RLS and transactional RPCs, Realtime for live updates. |
| Hard-coded service health and AI stats | Health endpoints, scheduled checks, logged AI usage. |
| Hard-coded weekly history, on-time %, "weekBase" | Calculated from orders and delivery records. |
| Operator presence fixed | Calculated from operator sign-in activity. |
| Time-of-day from the browser | Asia/Singapore server time. |

## 8. Gaps and inconsistencies found

These need a decision or a small fix. None changes the approved design.

1. **Service grid labels overlap on narrow phones.** At about 330px app width, labels such as "Invoices", "Insights" and "Availability" run into each other. Proposed fix: allow wrapping or truncation inside the tile.
2. **Insights chart label is wrong.** The aria-label says "last six weeks" but the chart shows five bars.
3. **Logo file names do not match.** The logos README names `tradelink-mark.svg`, `tradelink-mark-white.svg` and `tradelink-icon.svg`. The files are `tradelink-logo-green.svg`, `tradelink-logo-white.svg` and `tradelink-app-icon.svg`.
4. **Sora is used for the wordmark but is not in `tokens.json`.**
5. **The prototype's base CSS differs from the tokens** (for example 8 or 10px radii and weight 700 headings, later overridden). Build from `tokens.json` and the final computed styles.
6. **`line` contrast is below 3:1.** The README flags this for production. WCAG 2.2 AA needs a stronger border on inputs and controls (1.4.11). I will propose a token change in an ADR.
7. **Supplier minimum order is shown but never enforced.**
8. **Delivery days and lead time are shown but never used.** The cut-off logic always means "tomorrow". Orders have no delivery date, so on-time % cannot be calculated.
9. **"Total before GST" appears, but GST is never calculated.**
10. **Only admins have a notifications screen.** Buyers and suppliers rely on To do lists. The brief asks for real notifications for everyone.
11. **"Order the other {n}" after a part delivery** reorders from the supplier that just said it cannot send them.
12. **Invoice checks always use the latest delivered order.** The real flow needs to match an invoice to an order.
13. **The "Things to do" stat on buyer home links to the page it is on.** Proposed: scroll to To do.
14. **Admin "Low stock, See all" opens Suppliers**, which has no low-stock filter.
15. **The More sheet has no Escape handling or focus trap**, and the bottom nav uses `warn` counts while the service grid uses `bad`.
16. **There is no way to edit a business profile**, including the supplier's saved bank details that invoice checks rely on.
17. **There is no stock adjustment** for write-offs or count corrections, so the stock history cannot fix mistakes.
18. **A buyer can move an order to Delivered** with All here while it is Out for delivery. This is intended in the prototype, so I will keep it unless you say otherwise.
19. **There are no screens for multiple users per organisation**, or for admins to invite buyers.
20. **Weekly budget, usage rates and "in your shop" counts are manual.** The prototype shows no derived values.

## 9. Assumptions (proceeding with these unless told otherwise)

1. English only, en-SG formatting, S$ with 2 decimals, 24-hour times, Asia/Singapore. Weeks run Monday to Sunday.
2. Prices are stored ex-GST, as `numeric(12,2)`. The quantity is a whole number of the product's unit. Weight-based ordering converts to packs.
3. Supabase and Vercel run in Singapore (`ap-southeast-1`, `sin1`).
4. An organisation is either a buyer, a supplier or the Tradelink platform. Users belong to one organisation. Admins and operators are platform users.
5. Buyers see only suppliers they have a trading connection with. Inviting a supplier creates that connection. All AI matching uses this connected catalogue. (See Q1.)
6. Product category and art type become fields, seeded from the prototype's mapping.
7. Admins can view all orders but cannot change them. They act through disputes, suspensions, invitations and attention items, as in the prototype.
8. Offline: a cached app shell and last-viewed data, a clear offline banner, and all changes blocked while offline. No queued writes, because queued writes could oversell stock.
9. All stock changes go through Postgres functions that lock rows (`SELECT … FOR UPDATE`) and take an idempotency key.
10. Claude never writes: AI routes only return drafts that the buyer reviews. The model name comes from `ANTHROPIC_MODEL`.
11. Demo data reuses the prototype's fictional businesses, people, products and figures.
12. No emoji, no exclamation marks, sentence case, and the content rules in the design system README apply to new screens too.

## 10. Questions for you

Questions 1 to 6 change the data model or security design, so I need answers before finishing Phase 1. The others have defaults I can proceed with.

1. **Catalogue visibility.** Can a buyer see every supplier on the platform, or only suppliers they are connected to? I recommend connected suppliers only. That gives proper isolation, fits "match against the signed-in user's catalogue" and fits the invite flow. Do suppliers ever need different prices for different buyers?
2. **Accounts and onboarding.** How do buyer organisations join: self sign-up, admin invitation, or both? Can an organisation have several users, and if so do they need roles (owner, staff)? Sign-in by email and password only, or also magic link? Should admins and operators have MFA? (I recommend MFA for both.)
3. **Operators vs admins.** Are operators users who sign in with fewer permissions than admins? If so, what can each do (for example, resolve disputes, suspend suppliers, add operators)?
4. **Delivery dates.** Should every order carry a requested delivery date, worked out from the cut-off, delivery days and lead time? That is needed for on-time % and "Not here yet". Should minimum order block placing an order, or only warn?
5. **Bank details.** Where do saved supplier bank details come from, and who can change them? I suggest the supplier enters them in their profile, with a change notification to admins and to connected buyers.
6. **GST.** Do suppliers mark themselves as GST-registered, and should the review screen and invoice checks show GST (9%)?
7. **Notifications.** In-app only, or also email (invitations need email at least) and web push? Email needs a provider (Resend or Postmark), which I would propose in an ADR.
8. **Usual items.** Should use per day and "in your shop" be calculated from order and delivery history (editable), or entered manually as in the prototype?
9. **Supplier suspension.** When a supplier is suspended, should its products be hidden and its pending orders cancelled, held, or left to finish?
10. **Buyer-added products.** When the supplier confirms the product, they confirm both price and stock. Should pending orders then reprice to the confirmed price (with the buyer told), or keep the estimate?
11. **Stock adjustments.** Should suppliers be able to make a stock adjustment with a reason (damaged, count correction)? I recommend yes, logged in the stock history.
12. **Accounts and cost.** Do you already have GitHub, Vercel, Supabase and Anthropic Console accounts, and on which plans? Vercel Hobby limits cron jobs to once a day, and free Supabase projects pause when idle. A Supabase and a Vercel connector are available in this session; I will confirm which organisation to use before creating anything. Do you have a domain name in mind?
13. **Data retention.** How long should order texts, invoice files and AI logs be kept? Is there a privacy notice (PDPA) I should write against?
14. **Ask for suppliers.** Ask is buyer-only in the prototype. Confirm that suppliers and admins do not need it.

## 11. Decisions (3 November 2026)

| # | Decision | Source |
| --- | --- | --- |
| D1 | Buyers see only suppliers they are connected to. A connection is created when a buyer invites a supplier, or by an admin. One price list per supplier; per-buyer pricing is out of scope. | Owner |
| D2 | Two-factor sign-in (TOTP) is required for admins. It is optional for buyers and suppliers. | Owner |
| D3 | Operators and admins are the same role for now. "Operators" is the list of platform users who can be assigned attention items. | Owner |
| D4 | Every order carries a delivery date. The buyer may give a requested date (optional). The supplier sets the confirmed date when accepting. On-time % compares the delivered date with the confirmed date. | Owner |
| D5 | Minimum order warns, never blocks. Tradelink offers to negotiate: AI drafts a request (accept below minimum, add a delivery fee, or suggest items to reach it), the buyer approves each message before it is sent, and the supplier accepts, declines or counters. AI never commits the buyer. | Owner |
| D6 | No payments on the platform. Prices on orders and invoices feed analytics only. | Owner |
| D7 | Keep the bank-detail check. Suppliers save their bank account in their profile; Tradelink stores only a salted hash and the last 4 digits. A change alerts admins and connected buyers, and an invoice with a different account is marked "Do not pay yet". | Owner |
| D8 | No GST handling. Prices are stored and totalled as entered. The prototype's "Total before GST" label stays. Invoice extraction reads tax lines separately so they are not flagged as unexpected fees. | Owner |
| D9 | Buyer organisations join by admin invitation only. | Owner |
| D10 | An organisation can have several users, all with equal rights within their role. Members can invite colleagues. | Default (owner had no preference) |
| D11 | Questions 7, 8, 9, 10, 11, 13 and 14 use the defaults below. Question 12 (accounts and plans) is needed before Phase 2. | Default |
| D12 | Two-factor sign-in removed for now (supersedes D2). Admins, buyers and suppliers sign in with email and password only. | Owner, 3 November 2026 |
| D13 | Buyers and suppliers can create their own accounts; new accounts are connected to all active businesses of the other kind (supersedes D9 for now). | Owner, 3 November 2026 |

Defaults for questions 7 to 14:
- **Q7 Notifications:** in-app for every role (a bell and a Notifications page, reusing the admin design) and email for invitations, password reset, disputes, bank changes and negotiation messages. Web push is deferred. The email provider is chosen in an ADR.
- **Q8 Usual items:** use per day and "in your shop" are calculated from order and delivery history over the last 28 days, and the buyer can override them in Settings, as in the prototype.
- **Q9 Suspension:** a suspended supplier's products are hidden from buyers and no new orders can be placed. Pending orders are cancelled, their stock is released and buyers are told. Accepted and out-for-delivery orders can still be completed. The supplier can sign in read-only.
- **Q10 Buyer-added products:** when the supplier confirms stock, they also confirm the price. Pending orders take the confirmed price. If the price went up, the buyer gets a To do item to keep or cancel the line before the supplier can accept.
- **Q11 Stock adjustments:** yes. Suppliers can adjust stock with a reason (Damaged, Expired, Count correction), and each adjustment is recorded in the stock history.
- **Q13 Retention:** invoice files and order records are kept for 5 years. Raw order text and AI request logs are kept for 90 days, then only usage counts remain.
- **Q14 Ask:** buyer only.

## 12. Next step

Phase 1 produces the eight documents and the ADRs listed in the brief. Every screen in section 3, every rule in sections 5 and 6 and every decision above becomes user stories with IDs, priorities and testable acceptance criteria.
