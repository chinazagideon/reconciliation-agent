# Status

- **Current week:** Week 3 (kickoff, 5 July 2026)
- **Milestone:** Repo skeleton + schema first-cut + README v0.1 + ADR log
- **Now:** Scaffold generated. Next: implement `exact-matcher` + repository,
  then wire one end-to-end deterministic run before any AI code.
- **Blockers:** none

## Definition of "Week 3 done"
- [ ] 0001_init.sql applied to a local Postgres
- [ ] One deterministic run matches a synthetic Stripe+ledger dataset end to end
- [ ] Unmatched items land in agent_runs (agent still a stub)
- [ ] ADRs 0001-0005 committed

_Rule: do NOT start the agent until the deterministic core produces a residue.
The agent only earns the right to exist on items SQL couldn't resolve._
