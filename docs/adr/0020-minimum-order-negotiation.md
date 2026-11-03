# ADR 0020: Minimum-order negotiation with buyer approval

Status: Proposed

## Context
Decision D5: an order below a supplier's minimum gets a warning but is not blocked. Tradelink offers to negotiate with the supplier. AI drafts the messages, the buyer approves each one before it is sent, and the supplier accepts, declines or counters. AI must never commit the buyer. The prototype has no screens for this.

## Decision
- In review, a supplier group below its minimum shows: "Below Harbour Dry Goods' S$50.00 minimum by S$12.00." It offers two options:
  - **Add items**: AI suggests usual items from that supplier that would cover the gap.
  - **Ask to accept**: opens a request to the supplier.
- **Ask to accept** opens a message AI has drafted from the order facts: the gap, the order history and the delivery date. The buyer can edit it, then taps **Send with order**. The order is placed as Pending with `below_minimum = true` and a `negotiations` thread.
- The supplier sees the request on the order card and can choose **Accept as is**, **Accept with a delivery fee** (and enter the amount) or **Reject**.
- A fee is stored as a proposed `order_adjustments` row, and the order waits for the buyer. The buyer gets a To do item, "Harbour Dry Goods will deliver for a S$5.00 fee.", with **Accept fee** and **Cancel order**. AI may draft a reply, for example asking to waive the fee, but the buyer must approve it before it is sent. No fee is added without the buyer's tap.
- Every message records who wrote it (AI draft, buyer edit or supplier) and who approved sending it. Messages are emailed and appear as notifications (see ADR 0012).
- A negotiation allows at most 3 buyer messages, to keep it short.

## Alternatives considered
- AI sending messages automatically. Rejected by the owner, who chose approval of each message.
- Blocking orders below the minimum. Rejected by D5.

## Consequences
The new UI is built from existing components (Panel, TodoItem, Input, Button, Pill) and needs design review in Phase 3.
