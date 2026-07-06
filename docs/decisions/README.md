# Architecture Decision Records (ADRs)

This is the append-only log of *why* the system is shaped the way it is.

## Rules
1. **Append-only.** Never edit a past ADR's decision. To reverse one, add a new
   ADR that says `Supersedes: NNNN`, and set the old one's status to `Superseded`.
   (Same discipline as DB migrations - history is the value.)
2. **One decision per file.** SRP for docs.
3. **Write it at decision time.** Reconstructed rationale is fiction.

## Format
Each file: Title, Status, Context, Decision, Consequences.
Statuses: Proposed | Accepted | Superseded | Deprecated.

## Analogy
`git log` for architecture. Code comments explain a line; ADRs explain a
system-shaped choice no single line can hold.

## Index
- 0001 - Record architecture decisions
- 0002 - Polyglot: TypeScript core + Python sidecar
- 0003 - PostgreSQL, single instance
- 0004 - No vector store / embeddings
- 0005 - Deterministic core, AI at the boundary
- 0006 - Graceful degradation when AI sidecar is unavailable
