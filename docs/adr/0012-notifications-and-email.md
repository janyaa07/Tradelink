# ADR 0012: Notifications in-app and by email (adds Resend)

Status: Proposed

## Context
The brief asks for real notifications, but only admins have a notifications page in the prototype. Invitations and password resets need email.

## Decision
- Store notifications in a `notifications` table. Only database functions write to it, in the same transaction as the event. Each row targets an organisation (all its members) and, optionally, one user. Realtime pushes new rows to signed-in members.
- Every role gets a Notifications page using the prototype's admin design. It opens from a bell button next to ThemeToggle in the top bar and HomeHero, so the bottom bar keeps five tabs or fewer. Buyer and supplier To do lists stay as they are.
- Send email for invitations, password resets, two-factor changes, disputes, changed bank details, negotiation messages and invoices marked "Do not pay yet".
- Send emails after the transaction commits, through an `email_outbox` table (a transactional outbox). A Route Handler reads the outbox, sends each email, retries failures and records delivery status.
- Use **Resend** as the email provider. This adds the `resend` dependency. Supabase Auth emails also go through Resend's SMTP, so all mail comes from one verified domain.
- Web push is deferred.

## Alternatives considered
- Supabase's built-in email only. Rejected: it is rate-limited and meant for development.
- Postmark. A good alternative at a similar cost. Resend was chosen for its simpler TypeScript SDK and Vercel integration. The outbox design works with either.

## Consequences
The owner must verify a sending domain (an owner action in Phase 7). Until then, development uses the local Supabase mail catcher and Resend's test mode.
