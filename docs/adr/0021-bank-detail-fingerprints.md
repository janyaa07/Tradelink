# ADR 0021: Bank detail fingerprints for invoice checks

Status: Proposed

## Context
Decision D7 keeps the check for changed bank details. Tradelink never pays invoices (decision D6), so it does not need to store full account numbers.

## Decision
- Suppliers enter their bank name and account number in their business profile. The server normalises the digits and stores three things: an HMAC-SHA-256 fingerprint (`bank_account_hmac`, keyed with the server secret `BANK_FINGERPRINT_KEY`), the last 4 digits and the bank name. The full number is discarded after hashing.
- Changing bank details:
  - requires the user to have signed in within the last 10 minutes;
  - is written to the audit log;
  - notifies admins and every connected buyer: "Harbour Dry Goods changed its bank details. Check any invoice before paying."
- Invoice check: digits read from the invoice are normalised and fingerprinted in memory. If they do not match, the invoice is marked "Do not pay yet" and a security attention item is created. Only the last 4 digits of the invoice's account are stored.
- AI never writes bank details. Digits read from an invoice are never saved as the supplier's details.

## Alternatives considered
- Storing full account numbers encrypted. Rejected: a comparison does not need them, and storing them adds risk.
- Plain SHA-256. Rejected: account numbers are short enough to brute-force without a secret key.

## Consequences
Rotating `BANK_FINGERPRINT_KEY` means suppliers must enter their details again. The runbook will cover this.
