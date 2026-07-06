// First concrete strategy: exact match on (amount, currency, day).
// Deliberately the simplest thing that works (KISS). Tolerant matchers come later
// and ONLY run on this one's residue.
import type { Matcher } from "./matcher.js";
import type { MatchCandidate, Match } from "../../../domain/reconciliation/match.js";

export class ExactMatcher implements Matcher {
  readonly name = "exact";

  match(left: MatchCandidate[], right: MatchCandidate[]) {
    // TODO: index `right` by (amount|currency|yyyy-mm-dd), sweep `left`, pair 1:1.
    // TODO: return unpaired items as residue for the next strategy / the agent.
    const matches: Match[] = [];
    return { matches, leftResidue: left, rightResidue: right };
  }
}
