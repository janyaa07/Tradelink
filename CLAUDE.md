# Tradelink: working notes for Claude

## Commands
- `npm install --legacy-peer-deps` (npm 10.7 has a peer-set bug without the flag)
- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`
- `npm test`: Vitest with `--configLoader runner`, so it works on Node 20.15
- `npm run tokens`: regenerate `src/styles/tokens.css` from `design-handoff/design-system/tokens.json`

## Layout
| Folder | Contents |
| --- | --- |
| `app/<role>/` | Routes for each role (buyer, supplier, admin) |
| `src/ui/` | Design-system components |
| `src/features/<feature>/` | Server actions and queries |
| `src/domain/` | Pure rules, unit-tested |
| `src/data/` | Supabase clients, session and `callRpc` |
| `src/integrations/claude/` | AI, server only |

## Rules
- Reads use the user's Supabase session (RLS). Writes go only through the database functions in `docs/RPC_CONTRACT.md`, via `callRpc`. Never add insert, update or delete policies.
- Every write action:
  - validates with Zod;
  - sends an idempotency key when the function takes `p_key`;
  - maps errors with `src/lib/errors.ts`;
  - calls `revalidatePath`.
- Money is integer cents in TypeScript (`src/domain/money.ts`) and `numeric(12,2)` in Postgres. Times use Asia/Singapore.
- The AI never writes data. Its output is validated, grounded against the buyer's text and catalogue, and reviewed by a person.
- Copy follows the design system: sentence case, no exclamation marks, no emoji, buttons named with a verb and an object.
- No `any`, TODOs, dead code or `console.log` (use `src/lib/logger.ts`).
- Schema changes go in a new file in `supabase/migrations/`, named with the version Supabase records. Never edit an applied migration.
- `audit_log`, `stock_movements`, `price_changes` and `order_events` are append-only.
- Never commit `.env.local`. Never ask the owner to paste keys into chat.
