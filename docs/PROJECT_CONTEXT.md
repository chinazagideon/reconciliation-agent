# Project Context

## Problem
Marketplace operators reconcile three money sources by hand: the payment
processor (Stripe), the internal double-entry ledger, and supplier payouts.
Mismatches (fees, timing, partial captures, refunds) are found late and slowly.

## Persona
The marketplace operator / finance lead who needs to trust that money in == money
out, and needs an audit trail when it doesn't.

## What it does
1. Deterministic core matches records (exact, then tolerant strategies).
2. Unmatched items are handed to an AI reasoning sidecar.
3. Sidecar returns hypotheses + confidence, never authoritative answers.
4. Everything is written to an append-only audit log.

## Constraints (non-negotiable)
- Money is integer minor units. Never a float.
- Deterministic first; AI only on the residue.
- Idempotency keys on every write.
- Solo-operable at 11pm. No tech you can't debug alone.
- Demoable: "let me show you" beats "let me explain".

## Out of scope (see ADRs)
Redis, Kubernetes, vector embeddings, event sourcing, GraphQL,
Docker Compose orchestration of the whole stack.
