# ADR 0016: PWA with a hand-written service worker; read-only offline

Status: Proposed

## Context
The app ships as a responsive PWA. Orders made offline could oversell stock if they were sent later.

## Decision
- Generate the web app manifest from `app/manifest.ts`, with Tradelink icons made from `tradelink-app-icon.svg`.
- Write a small service worker by hand (`public/sw.js`, written in TypeScript and bundled at build). It:
  - precaches the app shell, fonts and icons;
  - serves read-only pages network-first, falling back to the last cached copy;
  - clears its cache on sign-out, so one user's data is never shown to the next.
- When offline, show a banner: "You are offline. Showing what was last loaded. Changes are paused until you reconnect." Disable every action button and show that reason. Queue no writes.

## Alternatives considered
- Serwist or next-pwa. Rejected for now: each adds a build integration that has to keep up with Next.js and Turbopack, and our needs are small.
- Offline ordering with a queue. Rejected: it risks overselling and confusing confirmations.

## Consequences
The install prompt works on Android and desktop. On iOS, users choose Add to Home Screen.
