# Buyer area redesign (owner feedback, 3 November 2026)

This is the shared brief for the buyer redesign. It overrides the prototype wherever the two differ. The supplier and admin areas keep their current pages but share the new shell and fonts.

## Principles
- **Clean, simple and intuitive.** Fewer panels, less text, more white space, and one clear primary action per screen.
- **Font:** Inter for everything, with IBM Plex Mono only for codes (`ORD-1044`, SKUs).
- **Colour:** keep the green brand for actions. Use the status colours (good, warn, bad) and a categorical chart palette where data needs it. Never colour alone: always pair it with a word or label.
- **Phone first.** Every page must work at 390px and 1280px, in light and dark.
- **Copy:** sentence case, no exclamation marks, no emoji.

## Routes
| Route | What it is | Owner |
| --- | --- | --- |
| `/buyer` | Home | Shell |
| `/buyer/assistant` | AI chat, "Tradelink Assistant" (renamed from Ask) | Assistant |
| `/buyer/cart` | The cart: review lines, split by supplier, confirm and place (the old review screen) | Assistant |
| `/buyer/orders` | Order tracking: compact list, filters, search | Orders |
| `/buyer/orders/[id]` | Order detail with actions (All here, Report a problem, Not here yet, Cancel) | Orders |
| `/buyer/products` | Products with pictures and add to cart (renamed from Availability) | Products |
| `/buyer/insights` | Dashboard | Insights |
| `/buyer/settings` | App settings and Shop settings, opened from the account menu | Shell |
| `/buyer/notifications` | All alerts, linked from the bell's pop-up | Shell |

Old URLs redirect:
- `/buyer/ask` goes to `/buyer/assistant`.
- `/buyer/order` goes to `/buyer/cart` if the cart has lines, otherwise to `/buyer/assistant`.
- `/buyer/availability` goes to `/buyer/products`.

## Navigation (buyer)
Home, Assistant, Orders, Products, Insights. Settings is in the account menu, not the nav (owner feedback, second round).

- **Phone:** the five sections are the bottom tabs.
- **Laptop:** there is no side rail. The section titles sit in the top bar on every page except Home, whose tiles already lead to them.

The top bar shows these on every page, home included:
- the bell, with an unread and action count. It opens a pop-up with "Needs your action" and the latest updates, each linking to its order, and a link to `/buyer/notifications`;
- the cart icon, with the number of lines in the cart, linking to `/buyer/cart`;
- the user's logo, which opens a menu with the name, the business, **Settings** and **Sign out**.

Suppliers and admins keep the side rail; their account menu also has Settings.

## The cart
The cart is the buyer's existing order draft (`order_drafts`). Add lines through `src/features/ordering/draft-store.ts` (`addLinesToDraft`) or `saveDraftAction`. The cart count is the number of draft lines. `placeOrdersAction` places the orders, one per supplier, and reserves stock.

## Alerts
The old "To do" items become actionable alerts on `/buyer/notifications`, in a "Needs your action" section above ordinary notifications. That covers price changes (OK, noted), part deliveries (Order the rest or Skip), replies to problems (OK) and credits (Mark received). Home has no To do panel.
