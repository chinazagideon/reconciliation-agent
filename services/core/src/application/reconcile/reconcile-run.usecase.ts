// ReconcileRun use case — orchestrates ONE run as a saga/state machine.
//
// Flow (deterministic core first, AI strictly at the boundary — ADR-0005):
//   1. pull records from each source (ports)
//   2. run matcher strategies in order; each consumes the prior residue
//   3. persist matches + counts (repository port)
//   4. hand ONLY the final residue to the agent port for hypotheses
//   5. write everything to the audit log
//
// Depends only on PORTS (interfaces), never concrete adapters. That inversion is
// the whole point of hexagonal: this file is unit-testable with fakes.
import type {
  ReconciliationRepository,
  RecordSource,
  AgentPort,
} from "../../domain/reconciliation/ports.js";
import type { Matcher } from "./matchers/matcher.js";
import { type Result, ok } from "../../domain/shared/result.js";

export class ReconcileRunUseCase {
  constructor(
    private readonly sources: RecordSource[],
    private readonly matchers: Matcher[],   // ordered: cheapest/strictest first
    private readonly repo: ReconciliationRepository,
    private readonly agent: AgentPort,
  ) {}

  async execute(windowStart: Date, windowEnd: Date): Promise<Result<{ runId: string }>> {
    // TODO: fetch from sources, fold matchers over residue, persist, then agent.
    // TODO: wrap each step in audit-log writes and idempotency guards.
    void this.sources; void this.matchers; void this.repo; void this.agent;
    void windowStart; void windowEnd;
    return ok({ runId: "TODO" });
  }
}
