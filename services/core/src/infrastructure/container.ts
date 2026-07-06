// Composition root — the ONE place concrete adapters get wired to ports.
// Everything above depends on interfaces; the graph is assembled exactly here.
// This is the seam that makes swapping Postgres for an in-memory fake trivial.
import { PgReconciliationRepository } from "../adapters/outbound/postgres/reconciliation.repository.js";
import { StripeRecordSource } from "../adapters/outbound/stripe/stripe.client.js";
import { HttpAgentClient } from "../adapters/outbound/agent/agent.client.js";
import { ExactMatcher } from "../application/reconcile/matchers/exact-matcher.js";
import { ReconcileRunUseCase } from "../application/reconcile/reconcile-run.usecase.js";

export function buildContainer() {
  const repo = new PgReconciliationRepository();
  const agent = new HttpAgentClient();
  const sources = [new StripeRecordSource() /* , new LedgerRecordSource() */];
  const matchers = [new ExactMatcher() /* , new TolerantMatcher() */]; // ordered

  const reconcileRun = new ReconcileRunUseCase(sources, matchers, repo, agent);
  return { reconcileRun };
}
