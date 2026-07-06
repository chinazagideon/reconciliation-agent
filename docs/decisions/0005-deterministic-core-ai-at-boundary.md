# 0005 - Deterministic core, AI at the boundary

**Status:** Accepted
**Date:** 2026-07-05

## Context
Money-touching AI must not hallucinate a match. Most AI demos hallucinate freely
because being wrong costs nothing. Here it costs money.

## Decision
The deterministic matcher runs first and owns all actual matches. The AI sidecar
only receives the *residue* (unmatched items) and returns hypotheses with
confidence scores - suggestions, never authoritative decisions. Low-confidence
outputs route to human-in-the-loop.

## Consequences
- (+) Defensible failure modes: audit trail, confidence, deterministic fallback.
- (+) The core interview story.
- (-) Won't "magically" resolve everything. Correct - that's the point.
