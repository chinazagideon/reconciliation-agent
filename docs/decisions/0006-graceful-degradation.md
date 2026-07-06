# 0006 - Graceful degradation when AI sidecar is unavailable

**Status:** Accepted
**Date:** 2026-07-06

## Context

The reconciliation pipeline has two layers: a deterministic matcher
(TypeScript core) and an AI explainer (Python sidecar). The sidecar
calls an external API (Anthropic Claude) and runs as a separate
process. Either the sidecar process or the upstream API can be
unavailable — network partition, deployment race, rate limit, outage.

The question: should the entire reconciliation run fail when an
optional enhancement layer is unreachable?

## Decision

No. When the AI sidecar is unreachable (health check fails, timeout,
5xx), the run **completes with deterministic results only**. The AI
explanation step is marked as `skipped` in the run record. The run
status is `done` (not `failed`), with an `ai_skipped: true` flag.

All residue items (transactions the deterministic matchers couldn't
resolve) are routed directly to the human review queue with a note:
"AI explanation unavailable — routed for manual review."

The health check (`GET /health`) is called once before sending the
residue batch. If unhealthy, the skip is immediate — no retries,
no circuit breaker complexity. KISS: the sidecar is either there or
it isn't.

## Consequences

- (+) The deterministic core resolves 84%+ of transactions without
  any AI involvement. Those results are independently valuable and
  should never be discarded because an optional layer failed.
- (+) Interview sentence: "The system degrades gracefully — if the
  AI layer is down, you still get most of your answers."
- (+) Operators can still act on deterministic matches immediately;
  the AI backfill can happen on a re-run later.
- (-) Human review queue is larger when AI is skipped. Accepted —
  a larger queue is better than no results at all.
- (-) No automatic retry or backfill of AI explanations when the
  sidecar comes back. Accepted for v1 — the operator can re-run
  the same window. Automatic backfill is a v2 concern.
