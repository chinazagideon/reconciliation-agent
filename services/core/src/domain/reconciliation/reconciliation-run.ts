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
// pending -> matching -> explaining -> done, with failed reachable from any
// active state. done/failed are terminal.
const TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  pending: ["matching", "failed"],
  matching: ["explaining", "done", "failed"], // done directly if there is no residue
  explaining: ["done", "failed"],
  done: [],
  failed: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
