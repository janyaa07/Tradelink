# ADR 0008: Claude behind a server-only AI module

Status: Proposed

## Context
Claude reads free-text orders and invoices, drafts minimum-order messages and powers Ask. AI may suggest and prepare, but must never send an order, change stock, pay or change bank details. Its output must be validated and treated as untrusted. Timeouts and failures need a manual fallback.

## Decision
- Use the official `@anthropic-ai/sdk` (1.x, currently 1.4.0), only inside `src/integrations/claude/`. That folder imports `server-only`. The key comes from `ANTHROPIC_API_KEY` and the model from `ANTHROPIC_MODEL` (default `claude-opus-5-5`). Neither is ever sent to the browser.
- Provide one typed function per feature, each with a Zod input schema and a Zod output schema:
  - `readOrder(text, catalogue)` returns a `ParsedOrder`: lines with source text, a product ID from the given catalogue or null, quantity, unit, kg, confidence, alternatives and notes.
  - `readInvoice(file, order)` returns an `ExtractedInvoice`: supplier, invoice number, date, lines, fees, tax lines, total and bank account digits.
  - `draftNegotiation(context)` returns a `NegotiationDraft`.
  - `ask(conversation)` returns an `AssistantTurn` (see ADR 0009).
- Get structured output from `client.messages.parse`, with `output_config.format` built from the Zod schema. Validate the parsed result again with the domain schema, and check every product ID against the catalogue sent in the request. An unknown ID becomes "Not in catalogue".
- Model settings:
  - Adaptive thinking. Opus 5.5 cannot turn thinking off.
  - `output_config.effort` set per feature and tuned against the evaluation set: `low` for order reading and drafts, `medium` for invoices and Ask.
  - No sampling parameters.
  - Server-side refusal fallback (`fallbacks: "default"`) on, so a policy decline is retried on another model within the same call. A final `refusal` is handled like any other failure.
- Use prompt caching on the stable prefix (instructions and catalogue) to cut cost and latency.
- Timeouts are 20 seconds for order reading and 45 seconds for invoices, with at most one SDK retry. On a timeout, refusal, API error or invalid output:
  - Order reading falls back to the rule-based reader ported from the prototype, and the UI says "We could not read this automatically. Check each line."
  - Invoice reading falls back to manual entry of the total and the bank digits.
- Log every call to `ai_usage`: feature, model, tokens, latency, outcome, and lines read and matched. Keep raw inputs and outputs in `ai_runs` for 90 days for evaluation (the Q13 default).
- Keep a labelled evaluation set: `evals/order-reading/*.jsonl` with at least 150 messages, plus invoice samples. It runs as a separate CI job with real API calls, on demand and nightly. It reports line match accuracy, quantity accuracy and the false-match rate against agreed thresholds.

## Alternatives considered
- Forced tool use to get JSON. Rejected: Opus 5.5 does not support it, and structured outputs are the supported route.
- Calling Claude from the browser. Rejected: it exposes the key and lets users skip validation.
- A cheaper model by default. Rejected: the owner chooses the model. The environment variable lets them switch after seeing evaluation results.

## Consequences
The AI module cannot write to the database. Callers save drafts for the user to review, and only user actions through database functions change data.
