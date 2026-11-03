# User guide

Tradelink replaces WhatsApp ordering between small food businesses and their suppliers. All businesses, people, products and figures in the demo are fictional.

## Demo accounts

All demo accounts use the password `Tradelink-demo-2026`. They exist only for demonstration; change or remove them before real businesses use the app.

| Role | Email | Business |
| --- | --- | --- |
| Buyer | mei@noodlehouse.example | Mei's Noodle House |
| Buyer | arif@seaside.example | Seaside Kopitiam |
| Supplier | priya@harbourdry.example | Harbour Dry Goods |
| Supplier | daniel@freshlane.example | Fresh Lane Produce |
| Admin | hannah@tradelink.example | Tradelink Operations |

### Two-factor sign-in for admins

Admins must use two-factor sign-in. The demo admin (`hannah@tradelink.example`) is already enrolled with this **demo-only** authenticator secret:

`ONGB725AO77LRT3ONS4BJWS7LROEB2HC`

To sign in as Hannah:
1. In any authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others), add an account by entering this setup key manually, as a time-based code.
2. Sign in with the email and password above.
3. Enter the 6-digit code the app shows.

Because this secret is published, the demo admin account offers no real protection. Remove or re-enrol it before any real business uses Tradelink. The other admin accounts are asked to set up their own authenticator the first time they sign in.

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
