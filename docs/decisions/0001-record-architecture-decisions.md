# 0001 - Record architecture decisions

**Status:** Accepted
**Date:** 2026-07-05

## Context
Solo project. Future-me and interviewers both need to know *why* choices were made.
Undocumented rationale evaporates within weeks.

## Decision
Keep a numbered, append-only ADR log in `docs/decisions/`. Every significant,
hard-to-reverse choice gets an ADR at the time it's made.

## Consequences
- (+) Interview bargaining chip: decisions are receipts, not claims.
- (+) Onboarding (even for future-me) is fast.
- (-) Small ongoing writing cost. Accepted - it pays back in interviews alone.
