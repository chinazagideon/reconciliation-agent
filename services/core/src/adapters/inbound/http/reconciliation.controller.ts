// Driving adapter. Controllers ONLY: parse/validate input, delegate to the use
// case, shape the output. No business logic here (SRP). Reconciliation is a
// synchronous call for v1's demo scale; Phase 5 moves it behind the queue.
import type { FastifyInstance } from "fastify";
import type { buildContainer } from "../../../infrastructure/container.js";
import type { Queue } from "../../../infrastructure/queue.js";

type Container = ReturnType<typeof buildContainer>;

function parseWindow(body: unknown): { start: Date; end: Date } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const start = new Date(String(b.windowStart));
  const end = new Date(String(b.windowEnd));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (start >= end) return null;
  return { start, end };
}

export function registerReconciliationRoutes(app: FastifyInstance, c: Container, queue?: Queue) {
  // Kick off a reconciliation run over a date window. With a queue, the heavy
  // work runs off the request path: create the run, enqueue, return 202 + id.
  // Without one, run synchronously (fine at demo scale — N1 is < 30s).
  app.post("/reconciliations", async (req, reply) => {
    const win = parseWindow(req.body);
    if (!win) return reply.code(400).send({ error: "windowStart/windowEnd required (start < end)" });

    if (queue) {
      const created = await c.repo.createRun(win.start, win.end);
      if (!created.ok) return reply.code(500).send({ error: created.error.message });
      await queue.enqueue({
        runId: created.value.id,
        windowStart: win.start.toISOString(),
        windowEnd: win.end.toISOString(),
      });
      return reply.code(202).send({ status: "queued", runId: created.value.id });
    }

    const result = await c.reconcileRun.execute(win.start, win.end);
    if (!result.ok) return reply.code(500).send({ error: result.error.message });
    return reply.code(201).send({ status: "done", runId: result.value.runId });
  });

  // Demo tool: generate synthetic data + manifest (PRD §3.1.4).
  app.post("/seed", async (_req, reply) => {
    const result = await c.seeder.run();
    if (!result.ok) return reply.code(500).send({ error: result.error.message });
    const m = result.value;
    return reply.code(201).send({
      data: {
        generated_at: m.generated_at,
        window: m.window,
        total_records: m.total_records,
        expected_results: m.expected_results,
      },
    });
  });
}
