// Entrypoint. Build the object graph, mount routes, listen.
// The reconcile saga runs off the request path via pg-boss unless QUEUE_ENABLED
// is explicitly "false" (synchronous mode — simplest for local/debug runs).
import { buildServer } from "./adapters/inbound/http/server.js";
import { registerReconciliationRoutes } from "./adapters/inbound/http/reconciliation.controller.js";
import { registerReadRoutes } from "./adapters/inbound/http/read.controller.js";
import { registerReviewRoutes } from "./adapters/inbound/http/review.controller.js";
import { buildContainer } from "./infrastructure/container.js";
import { startQueue, type Queue } from "./infrastructure/queue.js";
import { config } from "./infrastructure/config.js";

async function main() {
  const app = buildServer();
  const c = buildContainer();

  let queue: Queue | undefined;
  if (process.env.QUEUE_ENABLED !== "false") {
    queue = await startQueue(c.reconcileRun);
    app.log.info("reconcile queue started (pg-boss)");
  }

  registerReconciliationRoutes(app, c, queue);
  registerReadRoutes(app, c.query);
  registerReviewRoutes(app, c.review);

  const addr = await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`resolution-core listening on ${addr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
