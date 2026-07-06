// First concrete strategy: exact match on (amount, currency, UTC day).
// The strictest, cheapest lens — runs first (KISS). Only its residue reaches the
// tolerant matcher. One-to-one: a matched record is consumed and cannot re-match;
// when several candidates share a key, the closest timestamp wins.
import type { Matcher, MatcherResult } from "./matcher.js";
import type { MatchCandidate, Match } from "../../../domain/reconciliation/match.js";
import { exactKey } from "./keys.js";

export class ExactMatcher implements Matcher {
  readonly name = "exact";

  match(left: MatchCandidate[], right: MatchCandidate[]): MatcherResult {
    // Index right side by exact key -> queue of candidates (FIFO buckets).
    const buckets = new Map<string, MatchCandidate[]>();
    for (const r of right) {
      const k = exactKey(r);
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(r);
    }

    const matches: Match[] = [];
    const leftResidue: MatchCandidate[] = [];
    const consumedRight = new Set<string>();

    for (const l of left) {
      const bucket = buckets.get(exactKey(l));
      if (!bucket || bucket.length === 0) {
        leftResidue.push(l);
        continue;
      }
      // Prefer the unconsumed candidate closest in time.
      let bestIdx = -1;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (let i = 0; i < bucket.length; i++) {
        const cand = bucket[i]!;
        if (consumedRight.has(cand.transactionId)) continue;
        const delta = Math.abs(cand.occurredAt.getTime() - l.occurredAt.getTime());
        if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
      }
      if (bestIdx === -1) { leftResidue.push(l); continue; }
      const chosen = bucket[bestIdx]!;
      consumedRight.add(chosen.transactionId);
      matches.push({ left: l, right: chosen, strategy: "exact" });
    }

    const rightResidue = right.filter((r) => !consumedRight.has(r.transactionId));
    return { matches, leftResidue, rightResidue };
  }
}
