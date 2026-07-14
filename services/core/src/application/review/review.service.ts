// Human-in-the-loop review (PRD §3.3). The final gate: AI suggests, a human
// decides. Three actions, each append an audit entry with actor = user:<id>.
// Approving a `match_with:<txnId>` suggestion (or an override that names a
// target) promotes it to a real match with strategy 'human_approved'. The AI
// never writes a match itself — only this path can.
import type { PgQueryRepository } from "../../adapters/outbound/postgres/query.repository.js";
import type { ReconciliationRepository } from "../../domain/reconciliation/ports.js";
import { type Result, ok, err } from "../../domain/shared/result.js";

export type ReviewAction = "approve" | "override" | "dismiss";

export interface ReviewCommand {
  action: ReviewAction;
  actor: string;                       // e.g. "user:chinaza"
  note?: string | undefined;           // override explanation / free note
  matchWith?: string | undefined;      // target transaction id to pair with (override/approve)
}

function parseMatchTarget(suggestedAction: string | null): string | null {
  if (!suggestedAction) return null;
  const m = /^match_with:(.+)$/.exec(suggestedAction);
  return m ? m[1]! : null;
}

export class ReviewService {
  constructor(
    private readonly query: PgQueryRepository,
    private readonly repo: ReconciliationRepository,
  ) {}

  async act(reviewItemId: string, cmd: ReviewCommand): Promise<Result<{ resolution: string; matchCreated: boolean }>> {
    const itemRes = await this.query.getReviewItem(reviewItemId);
    if (!itemRes.ok) return err(itemRes.error);
    const item = itemRes.value;
    if (!item) return err(new Error("review item not found"));
    if (item.resolution) return err(new Error(`already resolved as ${item.resolution}`));

    let matchCreated = false;
    let resolution: string;

    if (cmd.action === "approve") {
      // Create a match if the suggestion (or the caller) names a counterpart.
      const target = cmd.matchWith ?? parseMatchTarget(item.suggested_action);
      if (target) {
        const created = await this.query.createHumanMatch(item.reconciliation_id, item.transaction_id, target);
        if (!created.ok) return err(created.error);
        matchCreated = true;
      }
      resolution = "approved";
    } else if (cmd.action === "override") {
      if (cmd.matchWith) {
        const created = await this.query.createHumanMatch(item.reconciliation_id, item.transaction_id, cmd.matchWith);
        if (!created.ok) return err(created.error);
        matchCreated = true;
      }
      resolution = "overridden";
    } else {
      resolution = "dismissed";
    }

    const resolved = await this.query.resolveReviewItem(reviewItemId, resolution, cmd.note ?? null, cmd.actor);
    if (!resolved.ok) return err(resolved.error);

    const audited = await this.repo.appendAudit([{
      actor: cmd.actor,
      event: "review.done",
      entityId: item.transaction_id,
      detail: { reviewItemId, resolution, matchCreated, note: cmd.note ?? null },
    }]);
    if (!audited.ok) return err(audited.error);

    return ok({ resolution, matchCreated });
  }
}
