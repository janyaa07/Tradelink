Tradelink helps small food businesses and their suppliers order, deliver and check stock. It should feel as easy as texting a supplier and as trustworthy as a good delivery note. Build every screen for someone busy, standing up and using one hand.

## Principles

- **Next action first.** Open each page with what the person needs to do now. Use `HomeHero`, `ServiceGrid` and `StatCard` on every home page, for every role.
- **One system, three roles.** Buyers, suppliers and admins share the same components. Only the content changes.
- **People stay in control.** Show what the app read or suggested, and let the person confirm. Copy says "Nothing is sent until you confirm."
- **Tap before type.** Offer usuals, suggestions and quick adds first. Keep free text for the order box and Ask.
- **State is never colour alone.** Pair every status colour with a word in `Pill` or a label in `TodoItem`.

## Content fundamentals

Write as a helpful colleague at the supplier counter: plain, short and specific. Address the reader as "you". Use sentence case everywhere, with no exclamation marks and no emoji. Use real units and amounts.

| Use | Avoid |
| --- | --- |
| Ready for tomorrow | Smart reorder recommendations |
| Only 3 available. Reduce the quantity. | Insufficient inventory error |
| Review and send | Submit |
| Enter a price above 0. | Invalid input |
| Do not pay INV-305 yet | Potential fraud risk detected |

Name buttons with a verb and object. Confirm with what happened, such as "2 orders placed and stock reserved." In errors, say what to fix. Write money as `S$52.00`, and times in 24-hour form, such as `16:00`.

## Colour

White and dark green carry the interface. Use `bg` and `surface` for grounds, `ink` for text and `accent` for actions and active states. Use `hero` and `hero-2` only for `HomeHero`. Use `accent-soft` behind icons and product art.

Keep `warn` and `bad` for things that need attention, and `good` for success. Never use a status colour as decoration. Business logos are the only other colours in the app.

Dark mode uses neutral charcoal grounds, with `surface` lighter than `bg` so cards stand out. Keep green for actions, active states and `hero`, and always pair an accent fill with `on-accent`. Offer System, Light and Dark in Settings, plus `ThemeToggle` in the header.

## Typography

Set everything in Plus Jakarta Sans. Use `page-title` once per page, `section-title` for cards and `body` for running text. Use `stat-value` and `price` for key numbers, with tabular figures. Use IBM Plex Mono through `id` only, for order, invoice and SKU codes.

## Layout and spacing

Design for phone first. The page padding is `space-14` on phone and `space-24` from 760px. Separate sections with `space-16`, and cards in a grid with `space-10`.

At 760px and above, `BottomNav` becomes a 228px white side rail, `ServiceGrid` becomes one row of eight, and `StatCard` shows four across. Below 620px, `StatCard` shows two across. Keep at most five bottom tabs, with the rest under More.

## Shape and depth

Corners are friendly but not bubbly: `radius-md` for controls, `radius-lg` for cards and `radius-full` for pills. Cards use a `line` border with `shadow-card`. Do not nest cards; use divided rows inside `Panel`. Show every list record, such as stock, suppliers and users, in the `OrderCard` layout: logo or product art, name, status, figures, then actions. Do not use tables.

## States and focus

- **Hover:** a default `Button` border changes to `accent`.
- **Focus:** a solid 2px `accent` ring with a 2px offset on every control.
- **Disabled:** 50% opacity, with a line explaining what is blocking the action.
- **Motion:** quick and functional, around 150ms to 250ms. Respect reduced-motion settings.
- **Empty states:** say what is true and what to do next, such as "You have enough stock for the next few days."

`line` is below 3:1 contrast, so inputs depend on visible labels and the focus ring. Tighten this before a production release.

## Iconography

Use thin outline icons on a 24px grid with a 1.8px stroke, rounded joins and `currentColor`. Use them for navigation and actions. Use solid silhouettes from `ProductArt` for products, on `accent-soft`. Use `BusinessLogo` for shops and suppliers. Do not use emoji as icons.

## Logo

The mark is a split T: two separate blocks, one for the buyer and one for the supplier, that form one letter together. Keep its flat, square-cut geometry and the thin gap between the blocks, with no shading or 3D effects.

Set `tradelink-mark.svg` beside the lowercase wordmark `tradelink`, in Sora 600 with -0.04em tracking, on light grounds. Make the mark about 1.3 times the wordmark size. Use `tradelink-mark-white.svg` on `hero` and dark grounds, and `tradelink-icon.svg` for app icons. Keep it at 20px or larger. The brighter green appears only in the logo, so the interface stays white and dark green.
