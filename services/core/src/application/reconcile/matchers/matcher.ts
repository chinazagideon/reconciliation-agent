// Matcher strategy interface (OCP: add new matchers without touching old ones).
//
// Analogy: matchers are interchangeable lenses on the same pile of records.
// Snap on the "exact" lens, it finds perfect pairs; snap on a "tolerant" lens,
// it finds pairs that differ only by a known fee. The use case just cycles lenses.
import type { MatchCandidate, Match } from "../../../domain/reconciliation/match.js";

export interface Matcher {
  readonly name: string;
  /** Given two sides, return matches found and the leftovers on each side. */
  match(
    left: MatchCandidate[],
    right: MatchCandidate[],
  ): { matches: Match[]; leftResidue: MatchCandidate[]; rightResidue: MatchCandidate[] };
}
