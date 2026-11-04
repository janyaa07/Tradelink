# Tradelink

Tradelink is a wholesale ordering platform for small food businesses and their suppliers. It replaces ordering over WhatsApp with one secure web app that works on phone, tablet and laptop, and installs as a progressive web app.

**Tradelink AI** is built into every page. It is an assistant that can read a buyer's order the way they would text it, explain an order, chase a supplier, and suggest what to do next. Its suggestions are checked against the catalogue, and a person approves them before anything changes.

All demo businesses, people and figures are fictional.

## Features

| Role | What they can do |
| --- | --- |
| **Buyers** | Type orders in plain words and review each line before sending. Reorder usual items. See a warning when an order is below a supplier's minimum. Track deliveries, including orders split across two delivery dates. Agree or decline a new delivery date. Message the supplier on an order. Report problems on arrival, and confirm when a promised credit has arrived. |
| **Suppliers** | Accept, part accept or reject orders. Deliver in one or two drops. Ask the buyer to move a delivery date. Answer problems with a credit or a replacement. Manage prices and stock, with a full stock history. |
| **Admins** | See what needs attention across the platform. Resolve disputes. Oversee suppliers and users. Read the append-only audit log. |

Every role has a home page with what to do next, a notification panel with a clear action for each notice, and Tradelink AI in a side panel.

## Tech stack

- **App:** Next.js 16 (App Router), React 19, TypeScript in strict mode
- **Styling:** Tailwind CSS 4, with design tokens generated from the design system in `design-handoff/`
- **Data:** Supabase (Postgres, Auth, Row Level Security)
- **AI:** Claude, through the official Anthropic SDK, on the server only
- **Validation and tests:** Zod, Vitest, Playwright
- **Hosting:** Vercel

## Architecture

- **Reads** use the signed-in user's Supabase session. Row Level Security limits every row to the user's business, its trading partners or, for admins, the platform.
- **Writes** go only through Postgres functions (`security definer`). Each one checks the caller and the state change, locks rows, and writes the stock history, audit log and notifications in one transaction. Critical actions are idempotent. See [docs/RPC_CONTRACT.md](docs/RPC_CONTRACT.md).
- **AI** returns structured output that is validated and grounded against the buyer's words and the catalogue. If the model is unavailable, a rule-based reader takes over. The AI never writes data on its own. See [docs/AI_DESIGN.md](docs/AI_DESIGN.md).
- **Money** is stored as integer cents in TypeScript and `numeric(12,2)` in Postgres. Times use Asia/Singapore.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/SECURITY.md](docs/SECURITY.md) and the decision records in [docs/adr/](docs/adr/README.md).

## Project structure

```text
app/                  Routes: buyer/, supplier/, admin/, sign-in and API routes
src/
  agents/             Tradelink AI agents and their tools
  cards/              Cards the AI shows to people, and their registry
  data/               Supabase clients, session and callRpc
  domain/             Pure business rules, unit tested
  features/           Server actions, queries and UI for each feature
  i18n/               User-facing text
  integrations/       Claude (server only)
  jobs/               Scheduled background jobs
  lib/                Errors, logging and shared helpers
  notifications/      Notification rules and delivery
  offline/, pwa/      Offline queue, service worker and install
  styles/, ui/        Design tokens and design-system components
supabase/
  migrations/         Database schema and functions, in the order applied
  seed.sql            Demo data (see "Demo data" below)
docs/                 Product, architecture and security documents
design-handoff/       Design system: tokens, components and assets
e2e/                  Playwright end-to-end tests
tests/                Database concurrency tests
scripts/              Token and icon generators
```

## Getting started

### Prerequisites

- Node.js 24 LTS (Node 20.9 or later also works)
- A Supabase project
- An Anthropic API key, for Tradelink AI

### Set up

1. Install dependencies. The flag works around a peer dependency bug in npm 10.7.
   ```bash
   npm install --legacy-peer-deps
   ```
2. Copy `.env.example` to `.env.local` and fill in your own values. `.env.local` is ignored by git; never commit it.
3. Apply the migrations in `supabase/migrations/` to your Supabase project, in file name order.
4. Start the development server and open http://localhost:3000.
   ```bash
   npm run dev
   ```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Server only | Supabase secret key, for AI output and background jobs |
| `ANTHROPIC_API_KEY` | Server only | Claude API key |
| `ANTHROPIC_MODEL` | Server only | Claude model id |
| `NEXT_PUBLIC_SITE_URL` | Browser and server | Public origin for links in emails, such as password reset |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Mixed | Web push notifications |
| `E2E_PASSWORD` | Tests only | Password of the demo accounts used by the tests |

Server-only values must never be prefixed with `NEXT_PUBLIC_`. In production they are set in the Vercel project settings, marked sensitive.

### Demo data

`supabase/seed.sql`, `supabase/mock-data.sql` and `supabase/tradelink-ai-mock-data.sql` create fictional businesses, products and orders. Before running them, replace `__DEMO_PASSWORD__` with a password of your choice; never commit it. The demo accounts are listed in [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check with TypeScript |
| `npm test` | Run the unit tests (Vitest) |
| `npm run e2e` | Run the end-to-end tests (Playwright) |
| `npm run check` | Regenerate tokens, then lint, type-check and test |
| `npm run tokens` | Regenerate `src/styles/tokens.css` from the design tokens |
| `npm run icons` | Regenerate the app icons |

## Testing

- **Unit tests** cover the business rules in `src/domain/` and the feature logic. Run `npm test`.
- **End-to-end tests** sign in as demo accounts and walk through ordering, delivery and problems. Set `E2E_PASSWORD` in `.env.local`, start the app, then run `npm run e2e`.
- **Concurrency tests** check that stock reservations hold under parallel orders. They write test data, so run them only against a test project:
  ```bash
  RUN_DB_TESTS=1 NODE_OPTIONS=--experimental-websocket npm test -- tests/concurrency
  ```

## Deployment

The repository is connected to Vercel. Pushes to `develop` create preview deployments, and `main` deploys to production. Database changes are added as new files in `supabase/migrations/`; an applied migration is never edited.

## Security

- Secrets live only in `.env.local` and the Vercel project settings. `.env.example` lists the names with placeholder values.
- Row Level Security is on for every table, and there are no insert, update or delete policies: all writes go through checked database functions.
- The audit log, stock history, price history and order history are append-only.
- Text from buyers and suppliers is treated as untrusted input to the AI. See [docs/SECURITY.md](docs/SECURITY.md) and [ADR 0010](docs/adr/0010-untrusted-content-and-prompt-injection.md).

To report a security issue, contact the maintainers privately; do not open a public issue.

## Documentation

See [docs/README.md](docs/README.md) for the full list. Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
