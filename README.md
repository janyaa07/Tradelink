# Tradelink

Tradelink is a wholesale ordering platform for small food businesses and their suppliers. It replaces ordering over WhatsApp with one secure web app, which works on phone, tablet and laptop.

- **Buyers** type orders the way they text a supplier. Claude reads them, and every line is reviewed before anything is sent. Stock is reserved per supplier, and deliveries are checked on arrival.
- **Suppliers** accept, part accept or reject orders, deliver them, answer problems, and manage inventory with a full stock ledger.
- **Admins** see what needs attention, resolve disputes, oversee suppliers and users, and read the append-only audit log.

All demo businesses, people and figures are fictional. Demo accounts are listed in [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Stack

Next.js 16 (App Router) with strict TypeScript, Tailwind CSS 4 with tokens generated from the design system, Supabase (Postgres, Auth, Row Level Security), the Claude API through the official Anthropic SDK (server side only, Claude Sonnet), Zod, Vitest, Vercel.

## Architecture in brief

- **Reads** use the signed-in user's Supabase session, so Row Level Security limits every row to the user's organisation, its trading connections or, for admins, the platform.
- **Writes** go only through Postgres functions (`security definer`). Each one checks the caller and the state transition, locks rows, and writes the stock ledger, audit log and notifications in one transaction. Critical actions are idempotent. See [docs/RPC_CONTRACT.md](docs/RPC_CONTRACT.md).
- **AI** lives in `src/integrations/claude/`. It returns structured output that is grounded against the buyer's words and catalogue. If it fails, a rule-based reader takes over. It never writes data.

| Folder | Contents |
| --- | --- |
| `app/` | Routes for each role and the sign-in page |
| `src/ui/` | Design-system components and the app shell |
| `src/features/` | Server actions and queries for each feature |
| `src/domain/` | Pure business rules |
| `src/data/` | Supabase clients and the session |
| `src/integrations/` | Claude |
| `supabase/` | Migrations and seed data |

Full design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/SECURITY.md](docs/SECURITY.md) and the decision records in [docs/adr/](docs/adr/README.md).

## Run locally

1. Install Node 24 LTS (Node 20.9 or later works for the app; the tests need `--configLoader runner` on older Node 20).
2. Install dependencies. The flag works around an npm 10.7 bug.
   ```bash
   npm install --legacy-peer-deps
   ```
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL, the publishable key and your own `ANTHROPIC_API_KEY`. Never commit `.env.local`.
4. Start the app.
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and sign in with a demo account.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check |
| `npm test` | Run the unit tests |
| `npm run tokens` | Regenerate `src/styles/tokens.css` from `design-handoff/design-system/tokens.json` |

`RUN_DB_TESTS=1 NODE_OPTIONS=--experimental-websocket npm test -- tests/concurrency` runs the concurrency test against a Supabase project. It writes a test product and orders, so never run it against production data.

## Deployment

The GitHub repository is connected to Vercel. Pushes to `develop` create preview deployments, and `main` deploys to production. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY` (marked sensitive) and `ANTHROPIC_MODEL` in Vercel. Database migrations live in `supabase/migrations/`.

## Status

Built on 3 November 2026 to the scope in [docs/TONIGHT_PLAN.md](docs/TONIGHT_PLAN.md). The rest of the approved plan, including invoices, invitations, two-factor sign-in, email, Ask, Insights and negotiation, is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
