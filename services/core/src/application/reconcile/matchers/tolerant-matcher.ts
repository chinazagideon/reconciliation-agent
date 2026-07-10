// Second pass. Runs ONLY on the exact matcher's residue and catches the common,
// explainable discrepancies via three ordered sub-strategies (PRD §3.2.2):
//   1. timing  — same amount/currency, dates differ by <= 1 day
//   2. fee     — same currency/day, amounts differ by a known fee or rounding
//   3. batch   — one record on side A == SUM of N records on side B
// Batch has a combinatorial SAFETY CAP: if the filtered candidate set exceeds
// 10, we do NOT search factorially — we flag the item for fraud review and let a
// human look, because an abnormally large candidate set is itself a signal.
import type { Matcher, MatcherResult } from "./matcher.js";
import type { MatchCandidate, Match, FraudFlag } from "../../../domain/reconciliation/match.js";
import { dayGap, utcDay } from "./keys.js";
import { withinFeeTolerance, ROUNDING_TOLERANCE_MINOR } from "../../../domain/shared/fees.js";

const BATCH_CANDIDATE_CAP = 10; // > this -> fraud flag, no combinatorial search

export class TolerantMatcher implements Matcher {
  readonly name = "tolerant";

  match(left: MatchCandidate[], right: MatchCandidate[]): MatcherResult {
    const matches: Match[] = [];
    const fraudFlags: FraudFlag[] = [];
    const usedL = new Set<string>();
    const usedR = new Set<string>();
    const availL = () => left.filter((l) => !usedL.has(l.transactionId));
    const availR = () => right.filter((r) => !usedR.has(r.transactionId));

    // --- 1. Timing tolerance: same amount & currency, <= 1 calendar day apart.
    for (const l of availL()) {
      let best: MatchCandidate | undefined;
      let bestGap = Number.POSITIVE_INFINITY;
      for (const r of availR()) {
        if (r.amount !== l.amount || r.currency !== l.currency) continue;
        const g = dayGap(l.occurredAt, r.occurredAt);
        if (g <= 1 && g < bestGap) { best = r; bestGap = g; }
      }
      if (best) {
        usedL.add(l.transactionId); usedR.add(best.transactionId);
        matches.push({ left: l, right: best, strategy: "tolerant:timing" });
      }
    }

    // --- 2. Fee tolerance: same currency & same day, amounts differ by a known
    //        fee pattern (Stripe 2.9%+$0.30) or a sub-cent rounding wobble.
    for (const l of availL()) {
      const best = availR().find(
        (r) =>
          r.currency === l.currency &&
          utcDay(r.occurredAt) === utcDay(l.occurredAt) &&
          r.amount !== l.amount &&           // equal amounts were exact/timing already
          withinFeeTolerance(l.amount, r.amount),
      );
      if (best) {
        usedL.add(l.transactionId); usedR.add(best.transactionId);
        matches.push({ left: l, right: best, strategy: "tolerant:fee" });
      }
    }

    // --- 3. Batch aggregation: one AGGREGATE record (a payout) == sum of >=2
    //        right entries (currency, date +-1). Only payout-type records are
    //        eligible targets; an ordinary charge is never the sum of others, so
    //        it must never be batch-attempted (and never fraud-flagged here).
    for (const l of availL()) {
      if (!l.isAggregate) continue;
      // A member is a smaller, same-currency entry within the date window.
      const candidates = availR().filter(
        (r) => r.currency === l.currency && dayGap(l.occurredAt, r.occurredAt) <= 1 && r.amount < l.amount,
      );
      if (candidates.length > BATCH_CANDIDATE_CAP) {
        // Safety cap tripped: bail out, route to fraud review, consume the target
        // so it does not fall through to the AI sidecar (PRD §3.2.2).
        usedL.add(l.transactionId);
        fraudFlags.push({ candidate: l, candidateCount: candidates.length });
        continue;
      }
      const combo = subsetSum(candidates, l.amount, ROUNDING_TOLERANCE_MINOR);
      if (combo && combo.length >= 2) {
        usedL.add(l.transactionId);
        for (const m of combo) usedR.add(m.transactionId);
        matches.push({
          left: l,
          right: combo[0]!,
          strategy: "tolerant:batch",
          memberIds: combo.map((m) => m.transactionId),
        });
      }
    }

    return {
      matches,
      leftResidue: availL(),
      rightResidue: availR(),
      fraudFlags,
    };
  }
}

// Bounded subset-sum: find a subset of `items` (size >= 2 preferred) whose
// amounts sum to `target` within `tol`. `items.length` is capped at 10 by the
// caller, so the 2^10 search space is trivially safe. Returns the members or null.
function subsetSum(
  items: MatchCandidate[],
  target: number,
  tol: number,
): MatchCandidate[] | null {
  const n = items.length;
  const chosen: MatchCandidate[] = [];
  let found: MatchCandidate[] | null = null;

  const dfs = (start: number, sum: number): void => {
    if (found) return;
    if (chosen.length >= 2 && Math.abs(sum - target) <= tol) {
      found = [...chosen];
      return;
    }
    if (start >= n || sum - target > tol) return; // prune: overshoot
    for (let i = start; i < n; i++) {
      chosen.push(items[i]!);
      dfs(i + 1, sum + items[i]!.amount);
      chosen.pop();
      if (found) return;
    }
  };
  dfs(0, 0);
  return found;
}
