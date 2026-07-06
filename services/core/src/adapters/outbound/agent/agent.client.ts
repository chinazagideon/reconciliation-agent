// Driven adapter: implements AgentPort by calling the Python FastAPI sidecar.
// The boundary where deterministic TS hands the residue to probabilistic Python.
import type { AgentPort, AgentExplanation } from "../../../domain/reconciliation/ports.js";
import type { MatchCandidate } from "../../../domain/reconciliation/match.js";
import { type Result, ok } from "../../../domain/shared/result.js";
import { config } from "../../../infrastructure/config.js";

export class HttpAgentClient implements AgentPort {
  async explain(unmatched: MatchCandidate[]): Promise<Result<AgentExplanation[]>> {
    // TODO: POST `${config.agentBaseUrl}/explain` with the unmatched items.
    // TODO: treat low confidence as needsHuman = true (default to caution).
    void unmatched; void config;
    return ok([]);
  }
}
