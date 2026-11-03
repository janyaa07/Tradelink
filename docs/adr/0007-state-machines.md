# ADR 0007: Explicit state machines in the database and the domain layer

Status: Proposed

## Context
Orders, issues, invoices, invitations and negotiations each move through defined states. Invalid transitions must be rejected.

## Decision
- Each state machine is defined once in TypeScript, in `src/domain/<entity>/state-machine.ts`. It is a table of rows, each with `from`, `to`, the action name and the roles allowed. The UI uses it to decide which actions to show.
- The same table lives in Postgres as `app.state_transitions`, seeded by a migration. Database functions call `app.assert_transition(entity, from, to, actor_role)`. A trigger on each entity table also rejects any status change that is not in the table.
- A test generates the SQL seed from the TypeScript tables and fails if the two differ.
- The machines are drawn in `docs/DATA_MODEL.md`.

## Alternatives considered
- Status checks inside each function only. Rejected: it is easy to miss a path. The trigger is a final guard.
- A state machine library such as XState. Rejected: an extra dependency for simple tables.

## Consequences
Adding a state needs a migration and a TypeScript change in the same PR. The parity test enforces this.
