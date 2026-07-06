# 0003 - PostgreSQL, single instance

**Status:** Accepted
**Date:** 2026-07-05

## Context
Financial data needs strong consistency, transactions, and foreign keys.
Raw provider payloads are semi-structured.

## Decision
Single Postgres instance. JSONB for raw payloads alongside normalized columns.
Schemas: reconciliation, audit, agent_runs. Not SQLite - Postgres signals
seriousness and is already fluent tech here.

## Consequences
- (+) ACID guarantees for money. JSONB flexibility for payloads.
- (-) Heavier local setup than SQLite. Accepted.
