# User guide

Tradelink replaces WhatsApp ordering between small food businesses and their suppliers. All businesses, people, products and figures in the demo are fictional.

## Demo accounts

All demo accounts use the password `Tradelink-demo-2026`. They exist only for demonstration; change or remove them before real businesses use the app.

| Role | Email | Business |
| --- | --- | --- |
| Buyer | mei@noodlehouse.example | Mei's Noodle House |
| Buyer | arif@seaside.example | Seaside Kopitiam |
| Buyer | siti@lotusleaf.example | Lotus Leaf Vegetarian |
| Buyer | weijie@goldencrust.example | Golden Crust Bakery |
| Supplier | priya@harbourdry.example | Harbour Dry Goods |
| Supplier | daniel@freshlane.example | Fresh Lane Produce |
| Supplier | ravi@islandspice.example | Island Spice Traders |
| Admin | hannah@tradelink.example | Tradelink Operations (also farid@, grace@ and vikram@tradelink.example) |

### What to try with each account

The mock data (`supabase/mock-data.sql`) puts orders in every state, so each account has something to do:

| Account | Things to try |
| --- | --- |
| **Siti** (Lotus Leaf) | Ready for tomorrow shows tofu and noodles. Check 3 deliveries, two of them out for delivery. Follow up the late report and the open problem. Acknowledge the coconut milk price alert. Cancel pending ORD-1064. |
| **Wei Jie** (Golden Crust) | Answer the part-delivery notice on ORD-1063. Mark the S$52.00 credit received. See the disputed problem ISS-305. Ready for tomorrow shows three items. |
| **Ravi** (Island Spice) | Accept, part accept or reject ORD-1064 and ORD-1065. Mark ORD-1058 delivered. Receive stock for dried chillies (out) and star anise (low). Change a price. |
| **Priya** (Harbour) | Answer problem ISS-302. Move accepted orders out for delivery and deliver them. |
| **Daniel** (Fresh Lane) | Answer the late report on ORD-1061 with "It is on the way". Mark it delivered. |
| **Hannah** (admin) | Resolve the ISS-305 dispute in Needs attention. Assign items to operators. Suspend and reactivate a supplier. Read the audit log. |
| **Mei and Arif** | Type an order in Order or Ask (Claude reads it), review it, and confirm and reserve stock. |

### Create your own account

On the sign-in page, choose **Create an account**. Pick buyer or supplier, then enter your business name, your name, an optional phone number, your email and a password of at least 12 characters.

A new buyer is connected to every active supplier, so the catalogue is ready to order from straight away. A new supplier is connected to every active buyer. Admin accounts cannot be created this way.

Two-factor sign-in is switched off for now (owner decision, 3 November 2026).

## Buyer walkthrough (Mei's Noodle House)

The top bar always shows the bell, the cart and your logo. The bell opens your alerts in a pop-up; each alert about an order has an arrow to that order. Tap your logo for **Settings** and **Sign out**. On a laptop, the section names (Home, Assistant, Orders, Products, Insights) sit in the top bar on every page except Home, where the tiles lead to them. On a phone they are the tabs at the bottom.

1. **Home** shows this week's spend, budget left, deliveries to check and alerts, then:
   - **Ready for tomorrow**: usual items running low, with **Add to cart**.
   - **Arriving**: deliveries on the way.
2. **Assistant** (or tap "What do you need to order?" on Home): type an order the way you would text a supplier, for example `2 ctn eggs and 3 tins coconut milk tmr`. You can also ask about prices, deliveries, spending, suppliers or your cart. The assistant shows what it read, and **Add to cart** puts the lines in your cart. Ask "place an order for items in my cart" to see the cart with a **Place order** button; nothing is ordered until you tap it. Your chats are kept in this browser: start a **New chat** or reopen one from the history (on a phone, tap **History**).
3. **Products**: browse products with pictures. **Add to cart** turns into a quantity stepper, and the cart icon updates.
4. **Cart**: lines are grouped by supplier, with cut-off times and the total. Fix any line marked **Check this** or **Not in catalogue**, adjust quantities, then tap **Place order**. Stock is reserved at that moment, one order per supplier.
5. **Orders**: find orders with the filters (Active, To check, Delivered, Problems, Cancelled) or search. Open an order to tap **All here**, **Report a problem**, **Not here yet** or **Cancel order**, and to follow any problem and the supplier's answer.
6. **Alerts** (the bell): things that need you, such as price changes, part deliveries, replies to problems and credits, then your latest updates. Tap an update, or the arrow on an alert, to open its order. **See all alerts** opens the full list.
7. **Insights**: spend against budget, week on week, spend by supplier, supplier on-time ratings and price changes.
8. **Settings** (from your logo): under **App settings**, your account and alerts. Under **Shop settings**, your weekly budget and usual items.

The live app is at https://tradelink-nine.vercel.app.

## Supplier walkthrough (Harbour Dry Goods)

1. **Sign in** as Priya. Home shows new orders, deliveries, To do and recent activity.
2. **Orders**:
   - **Accept order** and choose the delivery date, or use **Part accept** or **Reject**.
   - Later, **Mark out for delivery** and **Mark delivered**.
   - Answer problems with a credit, a replacement, an update or a dispute.
3. **Inventory**: add products, receive stock, change prices and adjust stock with a reason. Available means on hand minus reserved.
4. **Stock history** lists every stock change. **Activity** shows events for your business.

## Admin walkthrough (Tradelink Operations)

1. **Sign in** as Hannah. Home shows the top attention items, recent activity, low stock and the platform panel.
2. **Needs attention**: filter by priority, assign items to an operator, resolve disputes and mark system items handled.
3. **Orders, Suppliers, Users, Operators, Audit log**: read across the platform. On a supplier's page you can suspend or reactivate the supplier.
