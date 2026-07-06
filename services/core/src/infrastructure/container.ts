// Composition root — the ONE place concrete adapters get wired to ports.
// Everything above depends on interfaces; the graph is assembled exactly here.
// This is the seam that makes swapping Postgres for an in-memory fake trivial.
import { PgReconciliationRepository } from "../adapters/outbound/postgres/reconciliation.repository.js";
import { PgTransactionRepository } from "../adapters/outbound/postgres/transaction.repository.js";
import { StripeConnector } from "../adapters/outbound/stripe/stripe.client.js";
import { HttpAgentClient } from "../adapters/outbound/agent/agent.client.js";
import { HttpService } from "./http/http.service.js";
import { ExactMatcher } from "../application/reconcile/matchers/exact-matcher.js";
import { TolerantMatcher } from "../application/reconcile/matchers/tolerant-matcher.js";
import { ReconcileRunUseCase } from "../application/reconcile/reconcile-run.usecase.js";
import { Seeder } from "../application/seed/seeder.js";
import { config } from "./config.js";

export function buildContainer() {
  const repo = new PgReconciliationRepository();
  const txnRepo = new PgTransactionRepository();

  const agentHttp = new HttpService({ baseUrl: config.agentBaseUrl, retries: 1 });
  const agent = new HttpAgentClient(agentHttp, config.aiConfidenceThreshold);

  // Ingestors pull EXTERNAL data into `transactions`. The ledger is native to
  // our DB (seeded / app-written), so it needs no ingestor — only Stripe does.
  const ingestors = [new StripeConnector(config.stripeApiKey)];

  // Matchers run in order: strictest/cheapest first, AI only on what is left.
  const matchers = [new ExactMatcher(), new TolerantMatcher()];

  const reconcileRun = new ReconcileRunUseCase(ingestors, txnRepo, matchers, repo, agent, {
    leftSources: config.leftSources,
    rightSources: config.rightSources,
    aiConfidenceThreshold: config.aiConfidenceThreshold,
  });

  const seeder = new Seeder(txnRepo);

  return { reconcileRun, seeder, txnRepo, repo };
}
