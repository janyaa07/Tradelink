# ADR 0016: PWA with a hand-written service worker and an offline outbox

Status: Accepted (M0 of Tradelink AI, 3 November 2026). Replaces the earlier proposal, which cached pages and queued no writes.

## Context
Tradelink AI ships as an installable PWA now and a Capacitor shell later (docs/AI_DESIGN.md, section 2.1). Owners tap cards and send chat messages from kitchens with poor signal (section 4.7). A cached copy of a Next.js page or RSC payload can outlive a deploy and break the app in ways that are hard to see.

## Decision
- **Manifest.** `app/manifest.ts` serves `/manifest.webmanifest` for "Tradelink AI" (start URL `/r`, standalone, brand greens from the design tokens). `node scripts/build-icons.mjs` (`npm run icons`) draws the PNG icons in `public/icons` (192, 512, maskable 192 and 512, Apple touch 180) from the shapes in `public/icon.svg`, using only built-in modules.
- **Service worker.** `public/sw.js` is plain JavaScript with no build step. It:
  - caches only `/offline` and the icons, in a versioned cache (`tradelink-ai-v1`); older `tradelink-ai-` caches are deleted on activate;
  - never caches Next.js HTML, RSC payloads or API calls. Page loads go to the network, and the offline page is shown only when the network fails;
  - waits after installing until the page sends `SKIP_WAITING`, so the "New version ready" banner decides when to switch;
  - on `push`, shows the notification from `{title, body, url, notificationId, tag}`, unless a visible, focused window is open. Then it posts the payload to that window instead, and the app shows it in place;
  - on `notificationclick`, focuses a window (navigating it to the payload's same-origin path) or opens one, and POSTs `{notificationId}` to `/api/push/opened`.
  - Because no user data is cached, nothing needs clearing on sign-out.
- **Registration.** `src/pwa/PwaProvider.tsx` registers `/sw.js` in production builds, or in development with `NEXT_PUBLIC_ENABLE_SW=1`. It checks for a new version when the app returns to the front and relays foreground pushes as the `tradelink-ai:push` window event (`onForegroundPush`).
- **Forced update.** `src/pwa/UpdateGate.tsx` reads `app_release.min_version` for `web`. When `APP_VERSION` (`src/pwa/version.ts`) is lower, a full-screen "Update Tradelink AI to keep ordering" screen blocks the app until Refresh (SKIP_WAITING, then reload). A failed check never blocks, since the server still validates every write.
- **Push.** `src/pwa/push.ts` asks for permission only from a tap. On iPhone and iPad, `canUsePush()` is true only when Tradelink AI runs from the Home Screen.
- **Offline outbox.** `src/offline/outbox.ts` queues chat messages, card actions, card field edits and events in IndexedDB (`tradelink-ai-outbox`), keyed by the client id the caller already shows optimistically.
  - Items are sent in order, and the first item that must be retried holds back the rest.
  - 2xx removes an item. Any other 4xx, including 409 for a stale card, drops it and tells the caller to roll back.
  - 408, 429, 5xx, network errors and redirects (an expired session) are retried with backoff from 1 second, doubling, capped at 5 minutes.
  - The outbox flushes on start and on `online`. Web Locks keep two tabs from flushing at once.
  - Queued URLs must be same-origin paths.
- **Offline banner.** While offline, PwaProvider shows "You are offline. Changes will send when you reconnect." with the number waiting.

## Why replaying writes is now safe
The earlier proposal rejected a queue because a late order could oversell. Tradelink AI's queued writes are messages and card taps, not stock moves. The server de-duplicates each by its client id (EC06) and checks the card version on every tap. A replay therefore applies once, or is refused as stale and dropped, with "That was an older version. Here's the latest."

## Alternatives considered
- Serwist or next-pwa. Rejected: each adds a build integration that has to keep up with Next.js and Turbopack, and our needs are small.
- Network-first caching of pages. Rejected: stale HTML and RSC payloads after a deploy.

## Consequences
- The install prompt works on Android and desktop. On iOS, users choose Add to Home Screen, which web push also needs.
- `proxy.ts` skips `sw.js`, `manifest.webmanifest` and `icons/`, and `/offline` is a public path, so they load signed out.
- iPhone has no web haptics; `tapFeedback()` uses `navigator.vibrate` where it exists.
- `APP_VERSION` must be bumped with each release, and `min_version` raised only when old clients must stop ordering.
