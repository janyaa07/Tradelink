# ADR 0011: Authentication, two-factor sign-in and invitations

Status: Proposed

## Context
This ADR implements decisions D2 (two-factor sign-in), D9 (buyers join by admin invitation) and D10 (several users per organisation). Invitation tokens must be single-use, expiring and hashed.

## Decision
- Users sign in with email and password through Supabase Auth. Passwords need at least 12 characters and are checked against leaked-password lists (a Supabase setting). Password reset works by emailed link.
- Admins must use two-factor sign-in with an authenticator app (TOTP). Admin routes send the user to set it up, or to enter a code, until the session reaches `aal2`. Every admin RLS policy and database function also checks for `aal2`. Buyers and suppliers can turn two-factor on in Settings.
- There is no open sign-up. Supabase sign-ups are disabled, and accounts are created only by accepting an invitation.
- Invitation kinds:
  - `buyer_org`: an admin invites a new buyer business.
  - `supplier_org`: a buyer, or an admin, invites a new supplier.
  - `member`: a member invites a colleague.
  - `admin`: an admin invites another admin.
- Tokens:
  - Each token is 32 random bytes, encoded as base64url, and appears only in the email link.
  - The database stores the SHA-256 hash of the token, with the kind, organisation, email, inviter, expiry (7 days), status and time used.
  - Accepting or declining runs in one database function. It locks the invitation row, checks that the status is `pending`, that the token has not expired and that the email matches, then marks it used.
  - Resending revokes the old token and issues a new one.
- The public invitation page shows only what the invitee needs: who invited them, the business name, and for suppliers the waiting orders and products. Accepting leads to setting a password, plus two-factor for admins.

## Alternatives considered
- Magic-link-only sign-in. Not chosen for now, because the brief asks for password reset. It can be added later.
- Storing tokens as plain text. Rejected by the brief.

## Consequences
The seed script creates demo accounts with known passwords, for local and demo use only. They are documented in `docs/USER_GUIDE.md`.
