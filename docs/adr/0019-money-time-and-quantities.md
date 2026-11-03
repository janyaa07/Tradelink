# ADR 0019: Money, time zone and quantities

Status: Proposed

## Context
Money must use numeric types. The default currency is S$ and the time zone is Asia/Singapore. GST is not handled (decision D8).

## Decision
- **Database types:**
  - money: `numeric(12,2)`
  - usage rates: `numeric(10,3)`
  - quantities: `integer`, in the product's unit
  - pack weight: `numeric(8,3)`
- **Money in TypeScript:** money crosses the API as a decimal string such as `"52.00"`. A `Money` module handles it in integer cents, which is safe up to S$90 trillion, and rounds half away from zero, with tests. Lint blocks floating-point arithmetic on money.
- **Formatting:** `S$52.00`, en-SG locale, tabular figures.
- **Time:**
  - Store timestamps as `timestamptz`, and show them in Asia/Singapore time with 24-hour clock, such as `16:00`.
  - Store delivery dates as `date` values in Asia/Singapore.
  - Weeks run Monday to Sunday in Asia/Singapore.
  - Cut-off checks compare against the supplier's cut-off `time` in Asia/Singapore.
- Totals keep the prototype's "Total before GST" label. GST is not calculated.

## Alternatives considered
- Floating-point numbers. Rejected by the brief.
- A decimal library such as decimal.js. Rejected: integer cents cover our needs with less code.

## Consequences
Every money test includes rounding and large-value cases.
