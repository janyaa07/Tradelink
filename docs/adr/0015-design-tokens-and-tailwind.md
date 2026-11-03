# ADR 0015: Design tokens to Tailwind, and the control contrast fix

Status: Proposed

## Context
`design-handoff/design-system/tokens.json` is the source of truth for colour, type, spacing, radius and shadow in light and dark mode. The `line` colour is below 3:1 contrast, which fails WCAG 2.2 AA for the edges of inputs and controls (success criterion 1.4.11). Tailwind CSS 4 (4.3.4 on npm) sets up themes in CSS with `@theme`.

## Decision
- A build script, `scripts/build-tokens.ts`, reads `tokens.json` and writes `src/styles/tokens.css`. That file contains:
  - CSS variables on `:root` for light mode;
  - the dark values under `:root[data-theme="dark"]`, and under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` for System;
  - a Tailwind `@theme` block that maps utilities such as `bg-surface`, `text-muted`, `rounded-card` and `shadow-card` to those variables.
- CI fails if the generated file is out of date.
- Components use only token utilities. A lint rule blocks raw hex colours.
- Add one token, `control-line`, for the borders of inputs, selects, steppers and switches. The proposed values are `#7F9A8C` light and `#6E7A75` dark. Before adoption, both must be checked to reach at least 3:1 against `surface` and `sunken`. Decorative dividers keep `line`. This needs design sign-off.
- The theme setting (System, Light or Dark) is stored on the user's profile and copied to a cookie, so the server renders the right theme with no flash.
- Load Plus Jakarta Sans and IBM Plex Mono through `next/font`, self-hosted at build time. Use Sora 600 only for the wordmark, and add Sora to the font families in `tokens.json`.

## Alternatives considered
- Copying values into the Tailwind config by hand. Rejected: it drifts from the design source.

## Consequences
A design token change is a JSON edit plus regeneration, reviewed in a PR with screenshots.
