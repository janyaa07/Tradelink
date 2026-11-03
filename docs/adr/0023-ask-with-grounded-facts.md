# ADR 0023: Ask answers from grounded facts, not a tool runner

Status: Accepted (3 November 2026). Supersedes the tool-runner, streaming and history parts of ADR 0009.

## Context
ADR 0009 planned Ask as a tool-runner loop with read-only tools, streaming replies and 90-day history. For the release on 3 November, a smaller design was needed that kept the same safety properties.

## Decision
- A deterministic intent router answers the prototype's questions from the buyer's own queries under RLS: order number, spend, arrivals, reorder plan, usual items, reliability, prices and other shops. Answers come back as typed cards that the app renders.
- Typed orders go to the existing order reader. "Review order" adds the lines to the buyer's draft; Ask never places an order.
- Open questions are answered by Claude in two steps:
  1. The server builds a numbered list of facts (F1, F2, and so on) from read-only queries scoped to the buyer.
  2. Claude answers with structured output `{answer, factIds}`.

  Fact IDs that were never supplied are dropped. An answer that cites no supplied fact is replaced with the fallback copy. The buyer's message sits inside delimiters in the user turn, never in the system prompt.
- Replies come back whole, not streamed, and conversation history is kept only in the browser for the session.

## Alternatives considered
- Tool runner with streaming (ADR 0009). Deferred: more moving parts for the deadline. It can replace this design behind the same `askAction` without changing the UI.

## Consequences
Ask cannot answer questions that need data outside the facts list. It says so instead of guessing. The ask_messages table and 90-day retention are not needed yet.
