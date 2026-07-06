# 0002 - Polyglot: TypeScript core + Python sidecar

**Status:** Accepted
**Date:** 2026-07-05

## Context
Most agent tutorials default to pure Python. But the bulk of code here is
deterministic money logic + orchestration + Stripe SDK, where a strict type
system and existing muscle memory matter more.

## Decision
- **Core service in TypeScript (Fastify):** money logic, orchestration, Stripe.
- **One Python (FastAPI) sidecar:** the AI reasoning layer, using the Anthropic
  Claude SDK. Services talk over HTTP.

## Consequences
- (+) Clean seam: deterministic (TS) vs probabilistic (Python) at the boundary.
- (+) Python presence is expected signal for an AI project.
- (-) Two runtimes to operate. Mitigated: sidecar is tiny and stateless.
- Fallback if timeline slips: collapse to pure TS with the Anthropic SDK direct.
