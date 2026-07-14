// Driving adapter: read-only API. These endpoints feed the frontend —
// dashboard, run list/detail tabs, transaction detail, audit log — and make
// the whole data model verifiable over HTTP without a UI.
//
// Every response goes out through ./envelope, so the client sees one shape:
// `{ data }` for a single value, `{ data, total, page, per_page }` for a list.
import type { FastifyInstance } from "fastify";
import type { PgQueryRepository } from "../../../adapters/outbound/postgres/query.repository.js";
import { data, paginated, failure, pageParams } from "./envelope.js";

export function registerReadRoutes(app: FastifyInstance, query: PgQueryRepository) {
  // Runs list (dashboard "Recent Runs" + /runs page).
  app.get<{ Querystring: { page?: string; per_page?: string } }>(
    "/reconciliations",
    async (req, reply) => {
      const { page, perPage, limit, offset } = pageParams(req.query);
      const res = await query.listRuns(limit, offset);
      if (!res.ok) return reply.code(500).send(failure(res.error.message));
      return reply.send(
        paginated(res.value.rows, { total: res.value.total, page, perPage }),
      );
    },
  );

  // Run detail with all tabs (matched / explained / review / fraud) + rollup.
  // The tabs ship with the run: the client renders them straight from here
  // rather than issuing four more requests for data it already has.
  app.get<{ Params: { id: string } }>("/reconciliations/:id", async (req, reply) => {
    const run = await query.getRun(req.params.id);
    if (!run.ok) return reply.code(500).send(failure(run.error.message));
    if (!run.value) return reply.code(404).send(failure("run not found"));

    const [matched, explained, review, fraud] = await Promise.all([
      query.listMatches(req.params.id),
      query.listReviewItems(req.params.id, { kind: "ai", explainedOnly: true }),
      query.listReviewItems(req.params.id, { kind: "ai", onlyOpen: true, needsHumanOnly: true }),
      query.listReviewItems(req.params.id, { kind: "fraud" }),
    ]);
    for (const r of [matched, explained, review, fraud]) {
      if (!r.ok) return reply.code(500).send(failure(r.error.message));
    }
    return reply.send(
      data({
        run: run.value,
        tabs: {
          matched: matched.ok ? matched.value : [],
          explained: explained.ok ? explained.value : [],
          review: review.ok ? review.value : [],
          fraud: fraud.ok ? fraud.value : [],
        },
      }),
    );
  });

  // Transaction detail: record + counterpart + derived lifecycle (F12).
  app.get<{ Params: { id: string } }>("/transactions/:id", async (req, reply) => {
    const res = await query.getTransactionDetail(req.params.id);
    if (!res.ok) return reply.code(500).send(failure(res.error.message));
    if (!res.value) return reply.code(404).send(failure("transaction not found"));
    return reply.send(data(res.value));
  });

  // Global audit log, filterable by event / actor / date range (F9).
  app.get<{
    Querystring: {
      event?: string; actor?: string; since?: string; until?: string;
      page?: string; per_page?: string;
    };
  }>("/audit", async (req, reply) => {
    const q = req.query;
    const { page, perPage, limit, offset } = pageParams(q, 50);
    const res = await query.listAudit({
      event: q.event,
      actor: q.actor,
      since: q.since ? new Date(q.since) : undefined,
      until: q.until ? new Date(q.until) : undefined,
      limit,
      offset,
    });
    if (!res.ok) return reply.code(500).send(failure(res.error.message));
    return reply.send(
      paginated(res.value.rows, { total: res.value.total, page, perPage }),
    );
  });
}
