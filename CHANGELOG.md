# Changelog

All notable changes are listed here. The format follows Keep a Changelog, and versions follow semantic versioning.

## [0.1.0] - 2026-11-03

### Added
- **Shared**:
  - Sign in and sign out, with routing by role and blocked attempts recorded in the audit log.
  - App shell matching the prototype: bottom tabs with More on phone, side rail from 760px.
  - Light, dark and system themes; in-app notifications for every role; toasts; empty and error states.
- **Buyer**:
  - Home with To do, Ready for tomorrow and deliveries to check.
  - Ordering by typed text (read by Claude Sonnet with grounding checks and a rule-based fallback), usual items, product cards or manual entry.
  - Mandatory review with match states, substitutes, cut-off and budget warnings.
  - Confirm and reserve stock, split into one order per supplier.
  - Order tracking with All here, Report a problem and Not here yet.
  - Availability, and settings with usual items.
- **Supplier**:
  - Home and To do.
  - Incoming orders with accept (with delivery date), part accept, reject, out for delivery and delivered.
  - Answers to problems: credit, replace, update or dispute.
  - Inventory with add, receive, confirm, change price and adjust.
  - Stock history, activity and an editable business profile.
- **Admin**:
  - Home and Needs attention, built from live rules, with filters, assignment and dispute resolution.
  - All orders, suppliers with suspend and reactivate, users, buyer details, operators, audit log and settings.
- **Platform**:
  - Supabase schema with Row Level Security on every table.
  - Writes only through Postgres functions, with row locks and idempotency keys.
  - Explicit state machines, an append-only stock ledger and audit log, and fictional demo data.
  - Health endpoint.
  - Opt-in concurrency test proving that reservations never oversell.
- **Documentation**: Phase 0 discovery, Phase 1 architecture, data model, API, security, user stories, test plan, implementation plan, 22 ADRs, README and user guide.
