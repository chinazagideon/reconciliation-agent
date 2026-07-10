// pg-boss: a job queue backed by the SAME Postgres (no Redis — ADR scope).
// Heavy/slow work (Stripe pagination, the AI call) runs here, OFF the request
// path: POST /reconciliations creates the run row, enqueues a job, and returns
// 202 immediately; a worker drains the queue and runs the saga.
//
// Kept deliberately small and debuggable (solo-operable at 11pm): one queue, one
// worker, same connection string as everything else.
import PgBoss from "pg-boss";
import type { ReconcileRunUseCase } from "../application/reconcile/reconcile-run.usecase.js";
import { config } from "./config.js";

export const RECONCILE_QUEUE = "reconcile";

export interface ReconcileJob {
  runId: string;
  windowStart: string; // ISO — JSON-safe across the queue
  windowEnd: string;
}

export interface Queue {
  enqueue(job: ReconcileJob): Promise<void>;
  stop(): Promise<void>;
}

/** Start pg-boss, register the reconcile worker, return an enqueue handle. */
export async function startQueue(useCase: ReconcileRunUseCase): Promise<Queue> {
  const boss = new PgBoss(config.databaseUrl);
  boss.on("error", (e) => console.error("pg-boss error:", e));
  await boss.start();
  await boss.createQueue(RECONCILE_QUEUE);

  await boss.work<ReconcileJob>(RECONCILE_QUEUE, async ([job]) => {
    if (!job) return;
    const { runId, windowStart, windowEnd } = job.data;
    const res = await useCase.processRun(runId, new Date(windowStart), new Date(windowEnd));
    if (!res.ok) throw res.error; // let pg-boss record the failure; run is marked failed too
  });

  return {
    async enqueue(job: ReconcileJob) {
      await boss.send(RECONCILE_QUEUE, job);
    },
    async stop() {
      await boss.stop();
    },
  };
}
