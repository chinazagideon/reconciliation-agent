// The ReconciliationRun aggregate — the state machine for one run over a window.
// Pure domain: no DB, no HTTP, no framework imports. It only knows the RULES of
// how a run moves between states, not how it is persisted.

export type RunStatus = "pending" | "matching" | "explaining" | "done" | "failed";

export interface ReconciliationRun {
  readonly id: string;
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly status: RunStatus;
  readonly matchedCount: number;
  readonly unmatchedCount: number;
}

// Legal transitions live here (SRP: the run owns its own lifecycle rules).
// TODO: implement transition guards, e.g. can only go matching -> explaining.
export function canTransition(from: RunStatus, to: RunStatus): boolean {
  // TODO: replace with an explicit transition table
  return from !== to;
}
