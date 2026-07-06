// Entrypoint. Build the object graph, mount routes, listen.
import { buildServer } from "./adapters/inbound/http/server.js";
import { registerReconciliationRoutes } from "./adapters/inbound/http/reconciliation.controller.js";
import { buildContainer } from "./infrastructure/container.js";
import { config } from "./infrastructure/config.js";

const app = buildServer();
const { reconcileRun } = buildContainer();
registerReconciliationRoutes(app, reconcileRun);

app.listen({ port: config.port, host: "0.0.0.0" })
  .then((addr) => app.log.info(`resolution-core listening on ${addr}`))
  .catch((e) => { app.log.error(e); process.exit(1); });
