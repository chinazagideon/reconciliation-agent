// Driven adapter: implements AgentPort by calling the Python FastAPI sidecar.
// The boundary where deterministic TS hands the residue to probabilistic Python.
// All HTTP goes through the shared HttpService (one place for timeouts/retries/
// error mapping). Defaults to caution: any missing/failed field -> needsHuman.
import type { AgentPort, AgentExplanation } from "../../../domain/reconciliation/ports.js";
import type { MatchCandidate } from "../../../domain/reconciliation/match.js";
import { type Result, ok, err } from "../../../domain/shared/result.js";
import { HttpService } from "../../../infrastructure/http/http.service.js";

// Wire shape the Python sidecar returns (snake_case), mirrored from its DTOs.
interface WireExplanation {
  external_id: string;
  hypothesis: string;
  confidence: number;
  suggested_action: string;
  needs_human: boolean;
}

export class HttpAgentClient implements AgentPort {
  constructor(
    private readonly http: HttpService,
    private readonly confidenceThreshold: number,
  ) {}

  async health(): Promise<boolean> {
    const res = await this.http.request<{ status: string }>({ path: "/health", timeoutMs: 2000 });
    return res.ok && res.value?.status === "ok";
  }

  async explain(runId: string, unmatched: MatchCandidate[]): Promise<Result<AgentExplanation[]>> {
    const body = {
      run_id: runId,
      items: unmatched.map((c) => ({
        source: "unknown",
        external_id: c.transactionId,       // we key explanations by our txn id
        amount_minor: c.amount as number,
        currency: c.currency as string,
        occurred_at: c.occurredAt.toISOString(),
        raw: {},
      })),
    };
    const res = await this.http.request<WireExplanation[]>({
      path: "/explain",
      method: "POST",
      body,
      timeoutMs: 60_000,
    });
    if (!res.ok) return err(res.error);
    const explanations = (res.value ?? []).map<AgentExplanation>((w) => ({
      transactionId: w.external_id,
      hypothesis: w.hypothesis,
      confidence: w.confidence,
      suggestedAction: w.suggested_action,
      // Trust the sidecar's flag, but default to caution below our threshold.
      needsHuman: w.needs_human || w.confidence < this.confidenceThreshold,
    }));
    return ok(explanations);
  }
}
