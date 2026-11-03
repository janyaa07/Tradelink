# ADR 0001: Record architecture decisions

Status: Proposed

## Context
Tradelink is built in phases, with an approval after each one. Reviewers and future engineers need to see why each choice was made, not only what was built.

## Decision
Record each significant decision as a short Markdown ADR in `docs/adr/`, numbered in order, with the sections Context, Decision, Alternatives considered and Consequences. A new dependency, an external service or a change to a security boundary needs an ADR first.

## Alternatives considered
- Decisions only in pull request descriptions. Rejected: they are hard to find later and are not reviewed as a set.
- A wiki outside the repository. Rejected: it drifts from the code and is not versioned with it.

## Consequences
Each decision takes a little extra writing. `docs/TECHNICAL_DESIGN.md` links to the ADRs rather than repeating them.
