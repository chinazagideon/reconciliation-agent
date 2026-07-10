// Driving adapter: read-only API. These endpoints feed the (deferred) frontend
// — dashboard, run list/detail tabs, transaction detail, audit log — and make
// the whole data model verifiable over HTTP without a UI.
import type { FastifyInstance } from "fastify";
import type { PgQueryRepository } from "../../../adapters/outbound/postgres/query.repository.js";

export function registerReadRoutes(app: FastifyInstance, query: PgQueryRepository) {
  // Runs list (dashboard "Recent Runs" + /runs page).
  app.get("/reconciliations", async (_req, reply) => {
    const res = await query.listRuns();
    if (!res.ok) return reply.code(500).send({ error: res.error.message });
    return reply.send({ runs: res.value });
  });

  // Run detail with all tabs (matched / explained / review / fraud) + rollup.
  app.get<{ Params: { id: string } }>("/reconciliations/:id", async (req, reply) => {
    const run = await query.getRun(req.params.id);
    if (!run.ok) return reply.code(500).send({ error: run.error.message });
    if (!run.value) return reply.code(404).send({ error: "run not found" });

    const [matched, explained, review, fraud] = await Promise.all([
      query.listMatches(req.params.id),
      query.listReviewItems(req.params.id, { kind: "ai", explainedOnly: true }),
      query.listReviewItems(req.params.id, { kind: "ai", onlyOpen: true, needsHumanOnly: true }),
      query.listReviewItems(req.params.id, { kind: "fraud" }),
    ]);
    for (const r of [matched, explained, review, fraud]) {
      if (!r.ok) return reply.code(500).send({ error: r.error.message });
    }
    return reply.send({
      run: run.value,
      tabs: {
        matched: matched.ok ? matched.value : [],
        explained: explained.ok ? explained.value : [],
        review: review.ok ? review.value : [],
        fraud: fraud.ok ? fraud.value : [],
      },
    });
  });

  // Transaction detail: record + counterpart + derived lifecycle (F12).
  app.get<{ Params: { id: string } }>("/transactions/:id", async (req, reply) => {
    const res = await query.getTransactionDetail(req.params.id);
    if (!res.ok) return reply.code(500).send({ error: res.error.message });
    if (!res.value) return reply.code(404).send({ error: "transaction not found" });
    return reply.send(res.value);
  });

  // Global audit log, filterable by event / actor / date range (F9).
  app.get<{ Querystring: { event?: string; actor?: string; since?: string; until?: string; limit?: string } }>(
    "/audit",
    async (req, reply) => {
      const q = req.query;
      const res = await query.listAudit({
        event: q.event,
        actor: q.actor,
        since: q.since ? new Date(q.since) : undefined,
        until: q.until ? new Date(q.until) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      if (!res.ok) return reply.code(500).send({ error: res.error.message });
      return reply.send({ entries: res.value });
    },
  );
}
