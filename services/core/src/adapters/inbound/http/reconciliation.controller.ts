// Driving adapter. A controller ONLY: parse input, delegate, return output.
// No business logic here (that lives in the use case). SRP.
import type { FastifyInstance } from "fastify";
import type { ReconcileRunUseCase } from "../../../application/reconcile/reconcile-run.usecase.js";

export function registerReconciliationRoutes(
  app: FastifyInstance,
  useCase: ReconcileRunUseCase,
) {
  app.post("/reconciliations", async (req, reply) => {
    // TODO: validate body { windowStart, windowEnd } at this boundary.
    // TODO: const result = await useCase.execute(start, end);
    void useCase;
    return reply.code(202).send({ status: "accepted", runId: "TODO" });
  });
}
