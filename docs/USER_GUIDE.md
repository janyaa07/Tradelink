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
| **Ravi** (Island Spice) | Accept, part accept or reject ORD-1064 and ORD-1065. Mark ORD-1058 delivered. Restock dried chillies (out) and star anise (low). Change a price. |
| **Priya** (Harbour) | Answer problem ISS-302. Move accepted orders out for delivery and deliver them. |
| **Daniel** (Fresh Lane) | Answer the late report on ORD-1061 with "It is on the way". Mark it delivered. |
| **Hannah** (admin) | Resolve the ISS-305 dispute in Needs attention. Assign items to operators. Suspend and reactivate a supplier. Read the audit log. |
| **Mei and Arif** | Type an order in Order or Ask (Claude reads it), review it, and confirm and reserve stock. |

### Create your own account

On the sign-in page, choose **Create an account**. Pick buyer or supplier, then enter your business name, your name, an optional phone number, your email and a password of at least 12 characters.

A new buyer is connected to every active supplier, so the catalogue is ready to order from straight away. A new supplier is connected to every active buyer. Admin accounts cannot be created this way.

Two-factor sign-in is switched off for now (owner decision, 3 November 2026).

## Buyer walkthrough (Mei's Noodle House)

1. **Sign in** as Mei. Home shows what to do first:
   - **To do**: price changes, part deliveries and replies to problems.
   - **Ready for tomorrow**: usual items that will run out within 3 days.
   - **Arriving and to check**.
2. **Order**: type an order the way you would text a supplier, for example `2 ctn eggs, 10kg jasmine rice, oil x 2`, and tap **Read my order**. You can also tap your usual items, or add items by hand.
3. **Review**: every line shows what Tradelink understood:
   - **Matched**: the product is clear.
   - **Check this**: pick the right product.
   - **Not in catalogue**: choose a product, add it to the catalogue, or remove the line.

   Fix any lines with too much quantity, then check the split by supplier and the cut-off times. Nothing is sent until you tap **Confirm and reserve stock**.
4. **Orders**: track each order. When a delivery comes, tap **All here**, **Report a problem** or **Not here yet**.
5. **Ask**: ask about prices, deliveries, spending or which supplier is most reliable, or type an order. Ask only sees your own business, and an order typed there goes to review; Ask never sends it.
6. **Insights**: weekly spend against your budget, spend by supplier, each supplier's on-time record, and price changes on your usual items.
7. **Availability**: browse and search your suppliers' products.
8. **Settings**: set the weekly budget, the alerts and your usual items.

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
