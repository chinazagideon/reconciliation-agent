// Entrypoint. Build the object graph, mount routes, listen.
import { buildServer } from "./adapters/inbound/http/server.js";
import { registerReconciliationRoutes } from "./adapters/inbound/http/reconciliation.controller.js";
import { registerReadRoutes } from "./adapters/inbound/http/read.controller.js";
import { registerReviewRoutes } from "./adapters/inbound/http/review.controller.js";
import { buildContainer } from "./infrastructure/container.js";
import { config } from "./infrastructure/config.js";

const app = buildServer();
const c = buildContainer();
registerReconciliationRoutes(app, c);
registerReadRoutes(app, c.query);
registerReviewRoutes(app, c.review);

app.listen({ port: config.port, host: "0.0.0.0" })
  .then((addr) => app.log.info(`resolution-core listening on ${addr}`))
  .catch((e) => { app.log.error(e); process.exit(1); });
