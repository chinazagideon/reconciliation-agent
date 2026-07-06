# 0004 - No vector store / embeddings

**Status:** Accepted
**Date:** 2026-07-05

## Context
Every AI tutorial reaches for embeddings. Reconciliation retrieval is
*structured*: "all transactions for tasker X in date range Y."

## Decision
No vector store. Retrieval is SQL. YAGNI.

## Consequences
- (+) Less infra, lower cost, faster to demo.
- (+) Deterministic, explainable retrieval - which is the whole point for money.
- (-) None material. Revisit only if a genuine semantic-search need appears.
